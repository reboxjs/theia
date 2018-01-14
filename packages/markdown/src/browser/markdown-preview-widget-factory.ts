/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { interfaces } from "inversify";
import { WidgetFactory } from "@theia/core/lib/browser";
import { MarkdownPreviewWidget } from './markdown-preview-widget';
import URI from '@theia/core/lib/common/uri';

export class MarkdownPreviewOptions {
    readonly uri: string;
}

export const MARKDOWN_PREVIEW_WIDGET_FACTORY_ID = 'markdown-preview';

export class MarkdownPreviewWidgetFactory implements WidgetFactory {

    readonly id = MARKDOWN_PREVIEW_WIDGET_FACTORY_ID;

    protected widgetSequence = 0;

    constructor(
        protected readonly container: interfaces.Container,
    ) { }

    async createWidget(options: MarkdownPreviewOptions): Promise<MarkdownPreviewWidget> {
        const uri = new URI(options.uri);
        const widget = this.container.get(MarkdownPreviewWidget);
        widget.id = `markdown-preview-` + this.widgetSequence++;
        widget.title.label = `Preview '${uri.path.base}'`;
        widget.title.caption = widget.title.label;
        widget.title.closable = true;
        widget.uri = uri;
        return widget;
    }

}
