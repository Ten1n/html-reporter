'use strict';

const ApiFacade = require('./facade');

module.exports = class Api {
    static create(tool) {
        return new Api(tool);
    }

    constructor(tool) {
        this._gui = tool.gui = ApiFacade.create();
    }

    injectMiddleware(server) {
        return this._gui.emit(this._gui.events.INJECT_MIDDLEWARE, server);
    }
};
