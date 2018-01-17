/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { Widget } from '@phosphor/widgets';
import { Event, MaybePromise } from '../common';

export interface Saveable {
    readonly dirty: boolean;
    readonly onDirtyChanged: Event<void>;
    save(): MaybePromise<void>;
}

export interface SaveableSource {
    readonly saveable: Saveable;
}

export namespace Saveable {
    export function isSource(arg: any): arg is SaveableSource {
        return !!arg && ('saveable' in arg);
    }
    export function is(arg: any): arg is Saveable {
        return !!arg && ('dirty' in arg) && ('onDirtyChanged' in arg);
    }
    export function get(arg: any): Saveable | undefined {
        if (is(arg)) {
            return arg;
        }
        if (isSource(arg)) {
            return arg.saveable;
        }
        return undefined;
    }
    export function getDirty(arg: any): Saveable | undefined {
        const saveable = get(arg);
        if (saveable && saveable.dirty) {
            return saveable;
        }
        return undefined;
    }
    export function isDirty(arg: any): boolean {
        return !!getDirty(arg);
    }
    export async function save(arg: any): Promise<void> {
        const saveable = getDirty(arg);
        if (saveable) {
            await saveable.save();
        }
    }
    export function apply(widget: Widget): void {
        const saveable = Saveable.get(widget);
        if (saveable) {
            setDirty(widget, saveable.dirty);
            saveable.onDirtyChanged(() => setDirty(widget, saveable.dirty));

            const close = widget.close.bind(widget);
            widget.close = async () => {
                if (saveable.dirty) {
                    // const dialog = new ShouldSaveDialog(widget);
                    // if (await dialog.open()) {
                    //     await Saveable.save(widget);
                    // }
                }
                close();
            };
        }
    }
}

/**
 * The class name added to the dirty widget's title.
 */
const DIRTY_CLASS = 'theia-mod-dirty';
export function setDirty(widget: Widget, dirty: boolean): void {
    const dirtyClass = ` ${DIRTY_CLASS}`;
    widget.title.className = widget.title.className.replace(dirtyClass, '');
    if (dirty) {
        widget.title.className += dirtyClass;
    }
}

// export class ShouldSaveDialog extends AbstractDialog<boolean> {

//     protected shouldSave = true;
//     protected readonly dontSaveButton: HTMLButtonElement;

//     constructor(widget: Widget) {
//         super({
//             title: `Do you want to save the changes you made to ${widget.title.label || widget.title.caption}?`
//         });

//         const messageNode = document.createElement("div");
//         messageNode.textContent = "Your change will be lost if you don't save them.";
//         messageNode.setAttribute('style', 'flex: 1 100%; padding-bottom: calc(var(--theia-ui-padding)*3);');
//         this.contentNode.appendChild(messageNode);
//         this.contentNode.appendChild(this.dontSaveButton = this.createButton("Don't Save"));
//         this.appendCloseButton();
//         this.appendAcceptButton('Save');
//     }

//     protected onAfterAttach(msg: Message): void {
//         super.onAfterAttach(msg);
//         this.addKeyListener(this.dontSaveButton, Key.ENTER, () => {
//             this.shouldSave = false;
//             this.accept();
//         }, 'click');
//     }

//     get value(): boolean {
//         return this.shouldSave;
//     }
// }
