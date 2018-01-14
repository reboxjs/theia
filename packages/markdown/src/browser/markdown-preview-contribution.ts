/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable, inject } from "inversify";
import { FrontendApplicationContribution, FrontendApplication, OpenHandler, ApplicationShell } from "@theia/core/lib/browser";
import { EDITOR_CONTEXT_MENU, EditorManager } from '@theia/editor/lib/browser';
import { CommandContribution, CommandRegistry, Command, MenuContribution, MenuModelRegistry, CommandHandler } from "@theia/core/lib/common";
import { DisposableCollection } from '@theia/core';
import { WidgetManager } from '@theia/core/lib/browser/widget-manager';
import URI from '@theia/core/lib/common/uri';
import { Position } from 'vscode-languageserver-types';
import { MarkdownUri } from './markdown-uri';
import { MarkdownPreviewWidget } from './markdown-preview-widget';
import { MARKDOWN_PREVIEW_WIDGET_FACTORY_ID, MarkdownPreviewOptions } from './markdown-preview-widget-factory';

export namespace MarkdownPreviewCommands {
    export const OPEN: Command = {
        id: 'markdownPreview:open',
        label: 'Open Preview'
    };
}

@injectable()
export class MarkdownPreviewContribution implements CommandContribution, MenuContribution, OpenHandler, FrontendApplicationContribution {

    readonly id = MarkdownPreviewCommands.OPEN.id;
    readonly label = MarkdownPreviewCommands.OPEN.label;

    protected readonly cachedWidgets = new Map<string, MarkdownPreviewWidget>();
    protected readonly disposables = new DisposableCollection();

    @inject(FrontendApplication)
    protected readonly app: FrontendApplication;

    @inject(MarkdownUri)
    protected readonly markdownUri: MarkdownUri;

    @inject(WidgetManager)
    protected readonly widgetManager: WidgetManager;

    @inject(EditorManager)
    protected readonly editorManager: EditorManager;

    onStart() {
        this.syncWithCurrentEditor();
    }

    protected async syncWithCurrentEditor(): Promise<void> {
        this.editorManager.onCurrentEditorChanged(async editorWidget => {
            if (!editorWidget) {
                return;
            }
            this.disposables.dispose();
            const editor = editorWidget.editor;
            this.disposables.push(editor.onCursorPositionChanged(position => this.syncWithCursorPosition(editor.uri.toString(), position)));
        });
    }

    protected getPreviewWidgets(): Map<string, MarkdownPreviewWidget> {
        if (this.cachedWidgets.size === 0) {
            const previewWidgets = this.widgetManager.getWidgets(MARKDOWN_PREVIEW_WIDGET_FACTORY_ID);
            previewWidgets.forEach(widget => this.addPreviewWidget(widget as MarkdownPreviewWidget));
        }
        return this.cachedWidgets;
    }

    protected syncWithCursorPosition(uri: string, position: Position): void {
        const widget = this.getPreviewWidgets().get(uri);
        if (!widget) {
            return;
        }
        widget.revealForSourceLine(position.line);
    }

    canHandle(uri: URI): number {
        try {
            this.markdownUri.to(uri);
            return 50;
        } catch {
            return 0;
        }
    }

    async open(uri: URI): Promise<MarkdownPreviewWidget> {
        const widget = await this.getOrCreateWidget(uri);
        this.app.shell.activateMain(widget.id);
        return widget;
    }

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(MarkdownPreviewCommands.OPEN, <CommandHandler>{
            execute: () => this.openForActiveEditor(),
            isEnabled: () => this.isMarkdownEditorOpened(),
            isVisible: () => this.isMarkdownEditorOpened(),
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        const menuPath = [...EDITOR_CONTEXT_MENU, 'navigation'];
        menus.registerMenuAction(menuPath, {
            commandId: MarkdownPreviewCommands.OPEN.id,
            label: MarkdownPreviewCommands.OPEN.label,
        });
    }

    protected isMarkdownEditorOpened(): boolean {
        const activeEditor = this.editorManager.currentEditor;
        if (!activeEditor) {
            return false;
        }
        return activeEditor.editor.uri.path.ext === '.md';
    }

    protected openForActiveEditor(): void {
        const activeEditor = this.editorManager.currentEditor;
        if (activeEditor) {
            this.open(activeEditor.editor.uri);
        }
    }

    protected async getOrCreateWidget(uri: URI): Promise<MarkdownPreviewWidget> {
        const widget = this.getPreviewWidgets().get(uri.toString());
        if (widget) {
            return widget;
        }
        const newWidget = await this.createWidget(uri);
        return newWidget;
    }

    protected addPreviewWidget(widget: MarkdownPreviewWidget): void {
        const uri = widget.uri;
        widget.disposed.connect(() =>
            this.cachedWidgets.delete(uri.toString())
        );
        this.cachedWidgets.set(uri.toString(), widget);
    }

    protected async createWidget(uri: URI): Promise<MarkdownPreviewWidget> {
        const previewWidgets = this.getPreviewWidgets();
        const widget = <MarkdownPreviewWidget>await this.widgetManager.getOrCreateWidget(MARKDOWN_PREVIEW_WIDGET_FACTORY_ID, <MarkdownPreviewOptions>{
            uri: uri.toString()
        });
        const options: ApplicationShell.IMainAreaOptions = (previewWidgets.size > 0)
            ? { mode: 'tab-after', ref: previewWidgets.values().next().value }
            : { mode: 'split-right' };
        this.app.shell.addToMainArea(widget, options);
        this.addPreviewWidget(widget);
        await widget.start();
        return widget;
    }

}
