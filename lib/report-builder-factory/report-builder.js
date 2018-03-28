'use strict';

const path = require('path');
const Promise = require('bluebird');
const _ = require('lodash');
const fs = require('fs-extra');
const {IDLE, RUNNING, SUCCESS, FAIL, ERROR, SKIPPED, UPDATED} = require('../constants/test-statuses');
const {isIdleStatus} = require('../common-utils');
const {getCurrentPath, getReferencePath, getDiffPath, logger} = require('../server-utils');
const {setStatusForBranch, findNode} = require('../static/modules/utils');

const NO_STATE = 'NO_STATE';

module.exports = class ReportBuilder {
    static create(toolConfig, pluginConfig, TestAdapter) {
        return new ReportBuilder(toolConfig, pluginConfig, TestAdapter);
    }

    constructor(toolConfig, pluginConfig, TestAdapter) {
        this._tree = {name: 'root'};
        this._skips = [];
        this._toolConfig = toolConfig;
        this._pluginConfig = pluginConfig;
        this._TestAdapter = TestAdapter;
    }

    format(result) {
        const formattedResult = this._TestAdapter.create(result, this._toolConfig);
        formattedResult.attempt = getAttempt(this._tree, formattedResult);
        console.log('ATTEMPT ', formattedResult.attempt);
        // console.log('TREE');
        // console.dir(this._tree, {depth: null});
        return formattedResult;
    }

    addIdle(result) {
        this._addTestResult(result, {
            status: IDLE
        });
    }

    addSkipped(result) {
        const {
            suite: {
                skipComment: comment,
                fullName: suite
            },
            browserId: browser
        } = this.format(result);

        this._skips.push({suite, browser, comment});

        this._addTestResult(result, {
            status: SKIPPED,
            reason: comment
        });
    }

    addSuccess(result) {
        this._addSuccessResult(result, SUCCESS);
    }

    addUpdated(result) {
        this._addSuccessResult(result, UPDATED);
    }

    _addSuccessResult(result, status) {
        const formattedResult = this.format(result);
        console.log('ADD SUCCESS');

        this._addTestResult(result, {
            status,
            expectedPath: getReferencePath(formattedResult)
        });
    }

    addFail(result, props) {
        this._addFailResult(result, props);
    }

    _addFailResult(result, props = {}) {
        const formattedResult = this.format(result);
        this._addTestResult(result, _.extend({
            status: FAIL,
            actualPath: getCurrentPath(formattedResult),
            expectedPath: getReferencePath(formattedResult),
            diffPath: getDiffPath(formattedResult)
        }, props));
    }

    addError(result, props) {
        this._addErrorResult(result, props);
    }

    _addErrorResult(result, props = {}) {
        const formattedResult = this.format(result);
        this._addTestResult(result, _.extend({
            actualPath: formattedResult.state ? getCurrentPath(formattedResult) : '',
            status: ERROR,
            image: !!formattedResult.imagePath || !!formattedResult.currentPath || !!formattedResult.screenshot,
            reason: formattedResult.error
        }, props));
    }

    addRetry(result) {
        const formattedResult = this.format(result);

        if (formattedResult.hasDiff()) {
            this._addFailResult(result);
        } else {
            this._addErrorResult(result);
        }
    }

    setStats(stats) {
        this._stats = stats;

        return this;
    }

    _createTestResult(result, props) {
        const {browserId, suite, sessionId, description, attempt} = result;
        const {baseHost} = this._pluginConfig;
        const suiteUrl = suite.getUrl({browserId, baseHost});
        const metaInfo = {url: suite.fullUrl, file: suite.file, sessionId};

        return Object.assign({suiteUrl, name: browserId, metaInfo, description, attempt}, props);
    }

    _addTestResult(result, props) {
        result = this.format(result);
        const testResult = this._createTestResult(result, props);
        const {browserId, suite} = result;
        const {status} = props;

        const suitePath = suite.path.concat(result.state ? result.state.name : NO_STATE);
        const node = findOrCreate(this._tree, suitePath, status);
        node.browsers = Array.isArray(node.browsers) ? node.browsers : [];
        const existing = _.findIndex(node.browsers, {name: browserId});

        if (existing === -1) {
            node.browsers.push({name: browserId, result: testResult, retries: []});
            setStatusForBranch(this._tree, node.suitePath, status);

            return;
        }

        const stateInBrowser = node.browsers[existing];
        const previousResult = stateInBrowser.result;

        const statuses = [SKIPPED, RUNNING, IDLE];

        if (!statuses.includes(previousResult.status) && testResult.status !== UPDATED) {
            stateInBrowser.retries.push(previousResult);
        }

        stateInBrowser.result = testResult;
        setStatusForBranch(this._tree, node.suitePath, status);
    }

    save() {
        const reportDir = this._pluginConfig.path;

        return fs.mkdirsAsync(reportDir)
            .then(() => Promise.all([
                fs.writeFileAsync(path.join(reportDir, 'data.js'), this._prepareData(), 'utf8'),
                this._copyToReportDir(['index.html', 'report.min.js', 'report.min.css'])
            ]))
            .then(() => this)
            .catch((e) => logger.warn(e.message || e));
    }

    _prepareData() {
        const data = this.getResult();

        return [
            `var data = ${JSON.stringify(data)};`,
            'try { module.exports = data; } catch(e) {}'
        ].join('\n');
    }

    getResult() {
        const {defaultView, baseHost} = this._pluginConfig;

        return _.extend({
            skips: _.uniq(this._skips, JSON.stringify),
            suites: this._tree.children,
            config: {defaultView, baseHost}
        }, this._stats);
    }

    getSuites() {
        return this._tree.children;
    }

    _copyToReportDir(files) {
        return Promise.map(files, (fileName) => {
            const from = path.resolve(__dirname, '../static', fileName);
            const to = path.join(this._pluginConfig.path, fileName);

            return fs.copyAsync(from, to);
        });
    }

    get reportPath() {
        return path.resolve(`${this._pluginConfig.path}/index.html`);
    }
};

function findOrCreate(node, statePath) {
    if (statePath.length === 0) {
        return node;
    }

    node.children = Array.isArray(node.children) ? node.children : [];

    const pathPart = statePath.shift();
    node.suitePath = node.suitePath || [];

    if (pathPart === NO_STATE) {
        return node;
    }

    let child = _.find(node.children, {name: pathPart});

    if (!child) {
        child = {
            name: pathPart,
            suitePath: node.suitePath.concat(pathPart)
        };
        node.children.push(child);
    }

    return findOrCreate(child, statePath);
}

function getAttempt(tree, result) {
    console.log('FIND ATTEMPT', result.sessionId, result.suite.path);

    const {browserId, suite} = result;
    const suitePath = suite.path.concat(result.state ? result.state.name : NO_STATE);
    const node = findNode(tree, suitePath);
    if (!node) {
        return 0;
    }

    let index = _.findIndex(node.browsers, {name: browserId});
    if (index === -1) {
        return 0;
    }
    const state = node.browsers[index];

    const attempt = findAttemptInState(state, result.sessionId);
    if (attempt !== undefined) {
        return attempt;
    }

    return isIdleStatus(state.result.status) ? 0 : _.get(state, 'retries', []).length + 1;
}

function findAttemptInState(state, sessionId) {
    if (state.result.metaInfo.sessionId === sessionId) {
        return state.result.attempt;
    }
    const index = _.findIndex(state.retries, ['metaInfo.sessionId', sessionId]);
    return index === -1 ? undefined : state.retries[index].attempt;
}
