'use strict';

const {EventEmitter} = require('events');
const reportSubscriber = require('lib/gui/tool-runner-factory/gemini/report-subscriber');
const ReportBuilder = require('lib/report-builder-factory/report-builder');
const clientEvents = require('lib/gui/constants/client-events');
const {stubTool, stubConfig} = require('test/utils');

describe('lib/gui/tool-runner-factory/gemini/report-subscriber', () => {
    const sandbox = sinon.createSandbox();
    let reportBuilder;
    let client;

    const events = {
        END_RUNNER: 'endRunner'
    };

    const mkGemini_ = () => stubTool(stubConfig(), events);

    beforeEach(() => {
        reportBuilder = sinon.createStubInstance(ReportBuilder);
        sandbox.stub(ReportBuilder, 'create').returns(reportBuilder);
        reportBuilder.save.resolves();

        client = new EventEmitter();
        sandbox.spy(client, 'emit');
    });

    afterEach(() => sandbox.restore());

    describe('END_RUNNER', () => {
        it('should save report', () => {
            const gemini = mkGemini_();

            reportSubscriber(gemini, reportBuilder, client);

            return gemini.emitAndWait(gemini.events.END_RUNNER)
                .then(() => assert.calledOnce(reportBuilder.save));
        });

        it('should emit "END" event for client', () => {
            const gemini = mkGemini_();

            reportSubscriber(gemini, reportBuilder, client);

            return gemini.emitAndWait(gemini.events.END_RUNNER)
                .then(() => assert.calledOnceWith(client.emit, clientEvents.END));
        });
    });
});
