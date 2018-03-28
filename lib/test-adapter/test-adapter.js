'use strict';

module.exports = class TestAdapter {
    static create(testResult = {}, config = {}) {
        return new this(testResult, config);
    }

    constructor(testResult) {
        this._testResult = testResult;
        this._attempt = 0;
    }

    get suite() {
        return this._suite;
    }

    get sessionId() {
        return this._testResult.sessionId || 'unknown session id';
    }

    get browserId() {
        return this._testResult.browserId;
    }

    get imagePath() {
        return this._testResult.imagePath;
    }

    set attempt(attempt) {
        this._attempt = attempt;
    }

    get attempt() {
        return this._attempt;
    }
};
