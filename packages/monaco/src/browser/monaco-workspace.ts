/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable, inject, decorate } from "inversify";
import {
    MonacoWorkspace as BaseMonacoWorkspace, ProtocolToMonacoConverter, MonacoToProtocolConverter,
} from "monaco-languageclient";
import { EditorManager } from "@theia/editor/lib/browser";
import { MonacoTextModelService } from "./monaco-text-model-service";
import URI from "@theia/core/lib/common/uri";

decorate(injectable(), BaseMonacoWorkspace);
decorate(inject(MonacoToProtocolConverter), BaseMonacoWorkspace, 0);

@injectable()
export class MonacoWorkspace extends BaseMonacoWorkspace {
    readonly capabilities = {
        applyEdit: true,
        workspaceEdit: {
            documentChanges: true
        }
    };

    readonly synchronization = {
        didSave: true,
        willSave: true,
        willSaveWaitUntil: true
    };

    protected resolveReady: () => void;
    readonly ready = new Promise<void>(resolve => {
        this.resolveReady = resolve;
    });

    constructor(
        @inject(MonacoTextModelService) protected readonly textModelService: MonacoTextModelService,
        @inject(MonacoToProtocolConverter) protected readonly m2p: MonacoToProtocolConverter,
        @inject(ProtocolToMonacoConverter) protected readonly p2m: ProtocolToMonacoConverter,
        @inject(EditorManager) protected readonly editorManager: EditorManager
    ) {
        super(p2m, m2p);
        monaco.editor.onDidCreateModel(model => {
            this.textModelService.createModelReference(model.uri).then(reference => {
                reference.dispose();
            });
        });
    }

    get rootPath(): string | null {
        return this._rootUri && new URI(this._rootUri).path.toString();
    }

    applyEdit(changes: any): Promise<boolean> {
        const workspaceEdit = this.p2m.asWorkspaceEdit(changes);
        const promises = [];
        for (const edit of workspaceEdit.edits) {
            promises.push(this.textModelService.createModelReference(edit.resource).then(reference => {
                const model = reference.object.textEditorModel;
                // start a fresh operation
                model.pushStackElement();
                const range = edit.range;
                const selections = [new monaco.Selection(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn)];
                model.pushEditOperations(selections, [{
                    identifier: undefined!,
                    forceMoveMarkers: false,
                    range: new monaco.Range(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn),
                    text: edit.newText
                }], (edits) => selections);
                const editor = this.editorManager.editors[0]; // .find(editor => editor.editor.uri.toString() === model.uri.toString());
                if (editor) {
                    editor.editor.focus();
                }
                // push again to make this change an undoable operation
                model.pushStackElement();
                reference.dispose();
            }));
        }
        return Promise.all(promises).then(() => true);
    }

}
