/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { inject, injectable } from 'inversify';
import { MonacoToProtocolConverter, ProtocolToMonacoConverter } from 'monaco-languageclient';
import URI from "@theia/core/lib/common/uri";
import { DisposableCollection, Disposable, ResourceProvider } from "@theia/core/lib/common";
import { MonacoEditorModel } from "./monaco-editor-model";

@injectable()
export class MonacoTextModelService implements monaco.editor.ITextModelService {

    protected readonly models = new Map<string, monaco.Promise<MonacoEditorModel>>();
    protected readonly references = new Map<monaco.editor.ITextEditorModel, DisposableCollection>();

    constructor(
        @inject(ResourceProvider) protected readonly resourceProvider: ResourceProvider,
        @inject(MonacoToProtocolConverter) protected readonly m2p: MonacoToProtocolConverter,
        @inject(ProtocolToMonacoConverter) protected readonly p2m: ProtocolToMonacoConverter,
    ) { }

    createModelReference(raw: monaco.Uri | URI): monaco.Promise<monaco.editor.IReference<MonacoEditorModel>> {
        const uri = raw instanceof URI ? raw : new URI(raw.toString());
        return this.getOrCreateModel(uri).then(model =>
            this.newReference(model)
        );
    }

    protected newReference(model: MonacoEditorModel): monaco.editor.IReference<MonacoEditorModel> {
        let references = this.references.get(model);
        if (references === undefined) {
            references = new DisposableCollection();
            references.onDispose(() => model.dispose());
            model.onDispose(() => {
                this.references.delete(model);
                references!.dispose();
            });
            this.references.set(model, references);
        }

        let removeReference: Disposable;
        const reference: monaco.editor.IReference<MonacoEditorModel> = {
            object: model,
            dispose: () =>
                removeReference.dispose()
        };
        removeReference = references.push(reference);
        return reference;
    }

    protected getOrCreateModel(uri: URI): monaco.Promise<MonacoEditorModel> {
        const key = uri.toString();
        const model = this.models.get(key);
        if (model) {
            return model;
        }
        const newModel = this.createModel(uri);
        this.models.set(key, newModel);
        newModel.then(m => m.onDispose(() => this.models.delete(key)));
        return newModel;
    }

    protected createModel(uri: URI): monaco.Promise<MonacoEditorModel> {
        return monaco.Promise.wrap(this.loadModel(uri));
    }

    protected async loadModel(uri: URI): Promise<MonacoEditorModel> {
        const resource = await this.resourceProvider(uri);
        console.log('resource', resource);
        const model = await (new MonacoEditorModel(resource, this.m2p, this.p2m).load());
        return model;
    }

    protected readonly modelOptions: {
        [name: string]: (keyof monaco.editor.ITextModelUpdateOptions | undefined)
    } = {
            'editor.tabSize': 'tabSize'
        };

    registerTextModelContentProvider(scheme: string, provider: monaco.editor.ITextModelContentProvider): monaco.IDisposable {
        return {
            dispose(): void {
                // no-op
            }
        };
    }
}
