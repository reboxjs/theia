/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { inject, injectable } from "inversify";
import { Resource } from '@theia/core';
import { BaseWidget, Message, StatefulWidget } from '@theia/core/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { ResourceProvider } from '@theia/core/lib/common';

export const MARKDOWN_WIDGET_CLASS = 'theia-markdown-widget';

@injectable()
export class MarkdownPreviewWidget extends BaseWidget implements StatefulWidget {

    protected resource: Resource;
    protected uri: URI;

    @inject(ResourceProvider)
    protected readonly resourceProvider: ResourceProvider;

    constructor(
    ) {
        super();
        this.addClass(MARKDOWN_WIDGET_CLASS);
        this.node.tabIndex = 0;
        this.update();
    }

    onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        this.node.focus();
        this.update();
    }

    onUpdateRequest(msg: Message): void {
        super.onUpdateRequest(msg);
        if (this.resource) {
            this.resource.readContents().then(html =>
                this.node.innerHTML = html
            );
        }
    }

    storeState(): object {
        return { uri: this.resource.uri.toString() };
    }

    restoreState(oldState: object) {
        const state = oldState as any;
        if (state.uri) {
            const uri = this.uri = new URI(state.uri);
            this.start(uri);
        }
    }

    async start(uri: URI): Promise<void> {
        this.uri = uri;
        const resource = this.resource = await this.resourceProvider(uri);
        this.toDispose.push(resource);
        if (resource.onDidChangeContents) {
            this.toDispose.push(resource.onDidChangeContents(() => this.update()));
        }
        this.update();
    }

    revealForSourceLine(sourceLine: number): void {
        const markedElements = this.node.getElementsByClassName('line');
        let matchedElement: Element | undefined;
        for (let i = 0; i < markedElements.length; i++) {
            const element = markedElements[i];
            const line = Number.parseInt(element.getAttribute('data-line') || '0');
            if (line > sourceLine) {
                break;
            }
            matchedElement = element;
        }
        if (matchedElement) {
            matchedElement.scrollIntoView({ behavior: 'smooth' });
        }
    }
}
