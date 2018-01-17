/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import * as net from 'net';
// import * as cp from 'child_process';
import {
    injectable,
    // inject
} from "inversify";
import { Message, isRequestMessage } from 'vscode-ws-jsonrpc';
import { InitializeParams, InitializeRequest } from 'vscode-languageserver-protocol';
import {
    forward,
    IConnection
} from 'vscode-ws-jsonrpc/lib/server';
import { LanguageContribution } from "../common";

export {
    LanguageContribution, IConnection, Message
};

export const LanguageServerContribution = Symbol('LanguageServerContribution');
export interface LanguageServerContribution extends LanguageContribution {
    start(clientConnection: IConnection): void;
}

@injectable()
export abstract class BaseLanguageServerContribution implements LanguageServerContribution {

    abstract readonly id: string;
    abstract readonly name: string;

    abstract start(clientConnection: IConnection): void;

    protected forward(clientConnection: IConnection, serverConnection: IConnection): void {
        forward(clientConnection, serverConnection, this.map.bind(this));
    }

    protected map(message: Message): Message {
        if (isRequestMessage(message)) {
            if (message.method === InitializeRequest.type.method) {
                const initializeParams = message.params as InitializeParams;
                initializeParams.processId = process.pid;
            }
        }
        return message;
    }

    protected onDidFailSpawnProcess(error: Error): void {
        console.error(error);
    }

    protected logError(data: string | Buffer) {
        if (data) {
            console.error(`${this.name}: ${data}`);
        }
    }

    protected logInfo(data: string | Buffer) {
        if (data) {
            console.info(`${this.name}: ${data}`);
        }
    }

    protected startSocketServer(): Promise<net.Server> {
        return new Promise(resolve => {
            const server = net.createServer();
            server.addListener('listening', () =>
                resolve(server)
            );
            // allocate ports dynamically
            server.listen(0, '127.0.0.1');
        });
    }

    protected accept(server: net.Server): Promise<net.Socket> {
        return new Promise((resolve, reject) => {
            server.on('error', reject);
            server.on('connection', socket => {
                // stop accepting new connections
                server.close();
                resolve(socket);
            });
        });
    }

}
