/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { DisposableCollection } from '@theia/core/lib/common';
import URI from '@theia/core/lib/common/uri';
// import { DiffUris } from '@theia/editor/lib/browser/diff-uris';
import { inject, injectable } from 'inversify';
import { MonacoToProtocolConverter, ProtocolToMonacoConverter } from 'monaco-languageclient';

import { MonacoCommandServiceFactory } from './monaco-command-service';
import { MonacoContextMenuService } from './monaco-context-menu';
import { MonacoDiffEditor } from './monaco-diff-editor';
import { MonacoEditor } from './monaco-editor';
import { MonacoEditorModel } from './monaco-editor-model';
import { MonacoEditorService } from './monaco-editor-service';
import { MonacoQuickOpenService } from './monaco-quick-open-service';
import { MonacoTextModelService } from './monaco-text-model-service';
import { ThemeService } from '@theia/core/lib/browser/theming';

import IEditorOverrideServices = monaco.editor.IEditorOverrideServices;

function changeTheme(editorTheme: string | undefined) {
    const monacoTheme = editorTheme || 'vs-dark';
    monaco.editor.setTheme(monacoTheme);
    document.body.classList.add(monacoTheme);
}
changeTheme(ThemeService.get().getCurrentTheme().editorTheme);
ThemeService.get().onThemeChange(event => changeTheme(event.newTheme.editorTheme));

@injectable()
export class MonacoEditorProvider {

    constructor(
        @inject(MonacoEditorService) protected readonly editorService: MonacoEditorService,
        @inject(MonacoTextModelService) protected readonly textModelService: MonacoTextModelService,
        @inject(MonacoContextMenuService) protected readonly contextMenuService: MonacoContextMenuService,
        @inject(MonacoToProtocolConverter) protected readonly m2p: MonacoToProtocolConverter,
        @inject(ProtocolToMonacoConverter) protected readonly p2m: ProtocolToMonacoConverter,
        @inject(MonacoCommandServiceFactory) protected readonly commandServiceFactory: MonacoCommandServiceFactory,
        @inject(MonacoQuickOpenService) protected readonly quickOpenService: MonacoQuickOpenService
    ) { }

    protected async getModel(uri: URI, toDispose: DisposableCollection): Promise<MonacoEditorModel> {
        const reference = await this.textModelService.createModelReference(uri);
        console.log('reference', reference);
        toDispose.push(reference);
        return reference.object;
    }

    protected createEditor(create: (n: HTMLDivElement, o: IEditorOverrideServices) => MonacoEditor, toDispose: DisposableCollection): MonacoEditor {
        const node = document.createElement('div');
        const commandService = this.commandServiceFactory();
        const { editorService, textModelService, contextMenuService } = this;
        const override = {
            editorService,
            textModelService,
            contextMenuService,
            commandService
        };

        const editor = create(node, override);

        editor.onDispose(() => toDispose.dispose());
        const standaloneCommandService = new monaco.services.StandaloneCommandService(editor.instantiationService);
        commandService.setDelegate(standaloneCommandService);
        this.installQuickOpenService(editor);

        return editor;
    }

    async get(): Promise<MonacoEditor> {

        let editor: MonacoEditor;
        const toDispose = new DisposableCollection();

        editor = this.createEditor((node, override) => new MonacoEditor(
            node, this.m2p, this.p2m, override
        ), toDispose);

        console.log('editor', editor);

        return Promise.resolve(editor);
    }

    protected setOption(pref: string, value: any, options: any) {
        const prefix = "editor.";
        const option = pref.startsWith(prefix) ? pref.substr(prefix.length) : pref;
        const _setOption = (obj: { [n: string]: any }, value: any, names: string[], idx: number = 0) => {
            const name = names[idx];
            if (!obj[name]) {
                if (names.length > (idx + 1)) {
                    obj[name] = {};
                    _setOption(obj[name], value, names, (idx + 1));
                } else {
                    obj[name] = value;
                }
            }
        };
        _setOption(options, value, option.split('.'));
    }

    protected getEditorOptions(model: MonacoEditorModel): MonacoEditor.IOptions {
        const editorOptions: { [name: string]: any } = {
            model: model.textEditorModel,
            readOnly: model.readOnly
        };

        return editorOptions;
    }

    protected getDiffEditorOptions(original: MonacoEditorModel, modified: MonacoEditorModel): MonacoDiffEditor.IOptions {
        return {
            originalEditable: !original.readOnly,
            readOnly: modified.readOnly
        };
    }

    protected installQuickOpenService(editor: MonacoEditor): void {
        const control = editor.getControl();
        const quickOpenController = control._contributions['editor.controller.quickOpenController'];
        quickOpenController.run = options => {
            const selection = control.getSelection();
            this.quickOpenService.internalOpen({
                ...options,
                onClose: canceled => {
                    quickOpenController.clearDecorations();

                    if (canceled && selection) {
                        control.setSelection(selection);
                        control.revealRangeInCenterIfOutsideViewport(selection);
                    }
                    editor.focus();
                }
            });
        };
    }

}
