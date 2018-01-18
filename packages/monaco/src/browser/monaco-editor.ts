/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { MonacoToProtocolConverter, ProtocolToMonacoConverter } from "monaco-languageclient";
import { ElementExt } from "@phosphor/domutils";
import { DisposableCollection, Disposable, Emitter, Event } from "@theia/core/lib/common";
import {
    Dimension,
    EditorManager,
    EditorWidget,
    Position,
    Range,
    TextEditorDocument,
    TextEditor
} from '@theia/editor/lib/browser';

import IEditorConstructionOptions = monaco.editor.IEditorConstructionOptions;
import IEditorOverrideServices = monaco.editor.IEditorOverrideServices;
import IStandaloneCodeEditor = monaco.editor.IStandaloneCodeEditor;
import IBoxSizing = ElementExt.IBoxSizing;

export namespace MonacoEditor {
    export interface ICommonOptions {
        /**
         * Whether an editor should be auto resized on a content change.
         *
         * #### Fixme
         * remove when https://github.com/Microsoft/monaco-editor/issues/103 is resolved
         */
        autoSizing?: boolean;
        /**
         * A minimal height of an editor.
         *
         * #### Fixme
         * remove when https://github.com/Microsoft/monaco-editor/issues/103 is resolved
         */
        minHeight?: number;
    }

    export interface IOptions extends ICommonOptions, IEditorConstructionOptions { }
}

export function getAll(manager: EditorManager): MonacoEditor[] {
    return manager.editors.map(e => get(e)).filter(e => !!e) as MonacoEditor[];
}

export function getCurrent(manager: EditorManager): MonacoEditor | undefined {
    return get(manager.currentEditor);
}

export function getActive(manager: EditorManager): MonacoEditor | undefined {
    return get(manager.activeEditor);
}

export function get(editorWidget: EditorWidget | undefined) {
    if (editorWidget && editorWidget.editor instanceof MonacoEditor) {
        return editorWidget.editor;
    }
    return undefined;
}

export class MonacoEditor implements TextEditor {

    protected readonly toDispose = new DisposableCollection();

    protected readonly autoSizing: boolean;
    protected readonly minHeight: number;
    protected editor: IStandaloneCodeEditor;

    protected readonly onCursorPositionChangedEmitter = new Emitter<Position>();
    protected readonly onSelectionChangedEmitter = new Emitter<Range>();
    protected readonly onFocusChangedEmitter = new Emitter<boolean>();
    protected readonly onDocumentContentChangedEmitter = new Emitter<TextEditorDocument>();

    constructor(
        readonly node: HTMLElement,
        protected readonly m2p: MonacoToProtocolConverter,
        protected readonly p2m: ProtocolToMonacoConverter,
        override?: IEditorOverrideServices,
    ) {
        this.toDispose.push(this.create(override));
        this.autoSizing = false;
        this.minHeight = -1;
        this.addHandlers(this.editor);
    }

    //  protected create(options?: IEditorConstructionOptions, override?: monaco.editor.IEditorOverrideServices): Disposable {
    protected create(override?: monaco.editor.IEditorOverrideServices): Disposable {
        console.log('override', override);
        return this.editor = monaco.editor.create(this.node, {
            fixedOverflowWidgets: true,
            scrollbar: {
                useShadows: false,
                verticalHasArrows: false,
                horizontalHasArrows: false,
                verticalScrollbarSize: 10,
                horizontalScrollbarSize: 10
            }
        }, override);
    }

    protected addHandlers(codeEditor: IStandaloneCodeEditor): void {
        this.toDispose.push(codeEditor.onDidChangeConfiguration(e => this.refresh()));
        this.toDispose.push(codeEditor.onDidChangeModel(e => this.refresh()));
        this.toDispose.push(codeEditor.onDidChangeModelContent(() => {
            this.refresh();
            console.log('onDidChangeModelContent');
            // this.onDocumentContentChangedEmitter.fire(this.document);
        }));
        this.toDispose.push(codeEditor.onDidChangeCursorPosition(() =>
            this.onCursorPositionChangedEmitter.fire(this.cursor)
        ));
        this.toDispose.push(codeEditor.onDidChangeCursorSelection(e => {
            this.onSelectionChangedEmitter.fire(this.selection);
        }));
        this.toDispose.push(codeEditor.onDidFocusEditor(() => {
            this.onFocusChangedEmitter.fire(this.isFocused());
        }));
        this.toDispose.push(codeEditor.onDidBlurEditor(() =>
            this.onFocusChangedEmitter.fire(this.isFocused())
        ));
        this.addOnDidFocusHandler(codeEditor);
    }

    protected addOnDidFocusHandler(codeEditor: IStandaloneCodeEditor): void {
        // increase the z-index for the focussed element hierarchy within the dockpanel
        this.toDispose.push(this.editor.onDidFocusEditor(() => {
            const z = '1';
            // already increased? -> do nothing
            if (this.editor.getDomNode().style.zIndex === z) {
                return;
            }
            const toDisposeOnBlur = new DisposableCollection();
            this.increaseZIndex(this.editor.getDomNode(), z, toDisposeOnBlur);
            toDisposeOnBlur.push(this.editor.onDidBlurEditor(() =>
                toDisposeOnBlur.dispose()
            ));
        }));
    }

    get onDispose() {
        return this.toDispose.onDispose;
    }

    get onDocumentContentChanged(): Event<TextEditorDocument> {
        return this.onDocumentContentChangedEmitter.event;
    }

    get cursor(): Position {
        const { lineNumber, column } = this.editor.getPosition();
        return this.m2p.asPosition(lineNumber, column);
    }

    set cursor(cursor: Position) {
        const position = this.p2m.asPosition(cursor);
        this.editor.setPosition(position);
    }

    get onCursorPositionChanged(): Event<Position> {
        return this.onCursorPositionChangedEmitter.event;
    }

    get selection(): Range {
        return this.m2p.asRange(this.editor.getSelection());
    }

    set selection(selection: Range) {
        const range = this.p2m.asRange(selection);
        this.editor.setSelection(range);
    }

    get onSelectionChanged(): Event<Range> {
        return this.onSelectionChangedEmitter.event;
    }

    revealPosition(raw: Position): void {
        const position = this.p2m.asPosition(raw);
        this.editor.revealPositionInCenter(position);
    }

    revealRange(raw: Range): void {
        const range = this.p2m.asRange(raw);
        this.editor.revealRangeInCenter(range!);
    }

    focus() {
        this.editor.focus();
    }

    blur(): void {
        const node = this.editor.getDomNode();
        const textarea = node.querySelector('textarea') as HTMLElement;
        textarea.blur();
    }

    isFocused(): boolean {
        return this.editor.isFocused();
    }

    get onFocusChanged(): Event<boolean> {
        return this.onFocusChangedEmitter.event;
    }

    protected increaseZIndex(element: HTMLElement, z: string, toDisposeOnBlur: DisposableCollection) {
        const parent = element.parentElement;
        if (parent && !element.classList.contains('p-DockPanel')) {
            const oldIndex = element.style.zIndex;
            toDisposeOnBlur.push(Disposable.create(() =>
                element.style.zIndex = oldIndex
            ));
            element.style.zIndex = z;
            this.increaseZIndex(parent, z, toDisposeOnBlur);
        }
    }

    dispose() {
        this.toDispose.dispose();
    }

    getControl() {
        return this.editor;
    }

    refresh(): void {
        this.autoresize();
    }

    resizeToFit(): void {
        this.autoresize();
    }

    setSize(dimension: Dimension): void {
        this.resize(dimension);
    }

    protected autoresize() {
        if (this.autoSizing) {
            this.resize(null);
        }
    }

    protected resize(dimension: Dimension | null): void {
        if (this.node) {
            const layoutSize = this.computeLayoutSize(this.node, dimension);
            this.editor.layout(layoutSize);
        }
    }

    protected computeLayoutSize(hostNode: HTMLElement, dimension: monaco.editor.IDimension | null): monaco.editor.IDimension {
        if (dimension && dimension.width >= 0 && dimension.height >= 0) {
            return dimension;
        }
        const boxSizing = ElementExt.boxSizing(hostNode);

        const width = (!dimension || dimension.width < 0) ?
            this.getWidth(hostNode, boxSizing) :
            dimension.width;

        const height = (!dimension || dimension.height < 0) ?
            this.getHeight(hostNode, boxSizing) :
            dimension.height;

        return { width, height };
    }

    protected getWidth(hostNode: HTMLElement, boxSizing: IBoxSizing): number {
        return hostNode.offsetWidth - boxSizing.horizontalSum;
    }

    protected getHeight(hostNode: HTMLElement, boxSizing: IBoxSizing): number {
        if (!this.autoSizing) {
            return hostNode.offsetHeight - boxSizing.verticalSum;
        }
        const configuration = this.editor.getConfiguration();

        const lineHeight = configuration.lineHeight;
        const lineCount = this.editor.getModel().getLineCount();
        const contentHeight = lineHeight * lineCount;

        const horizontalScrollbarHeight = configuration.layoutInfo.horizontalScrollbarHeight;

        const editorHeight = contentHeight + horizontalScrollbarHeight;
        if (this.minHeight < 0) {
            return editorHeight;
        }
        const defaultHeight = lineHeight * this.minHeight + horizontalScrollbarHeight;
        return Math.max(defaultHeight, editorHeight);
    }

    isActionSupported(id: string): boolean {
        const action = this.editor.getAction(id);
        return !!action && action.isSupported();
    }

    runAction(id: string): monaco.Promise<void> {
        const action = this.editor.getAction(id);
        if (action && action.isSupported()) {
            return action.run();
        }
        return monaco.Promise.as(undefined);
    }

    get commandService(): monaco.commands.ICommandService {
        return this.editor._commandService;
    }

    get instantiationService(): monaco.instantiation.IInstantiationService {
        return this.editor._instantiationService;
    }

}
