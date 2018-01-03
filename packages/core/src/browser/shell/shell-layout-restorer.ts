/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable, inject } from 'inversify';
import { Widget } from '@phosphor/widgets';
import { FrontendApplication, FrontendApplicationContribution } from '../frontend-application';
import { WidgetManager, WidgetConstructionOptions } from '../widget-manager';
import { StorageService } from '../storage-service';
import { ILogger } from '../../common/logger';
import { CommandContribution, CommandRegistry } from '../../common/command';
import { ApplicationShell } from './application-shell';

/**
 * A contract for widgets that want to store and restore their inner state, between sessions.
 */
export interface StatefulWidget {

    /**
     * Called on unload to store the inner state.
     */
    storeState(): object;

    /**
     * Called when the widget got created by the storage service
     */
    restoreState(oldState: object): void;
}

export namespace StatefulWidget {
    // tslint:disable-next-line:no-any
    export function is(arg: any): arg is StatefulWidget {
        return typeof arg["storeState"] === 'function' && typeof arg["restoreState"] === 'function';
    }
}

interface WidgetDescription {
    constructionOptions: WidgetConstructionOptions,
    innerWidgetState?: object
}

@injectable()
export class ShellLayoutRestorer implements CommandContribution {
    private storageKey = 'layout';
    private shouldStoreLayout: boolean = true;

    constructor(
        @inject(WidgetManager) protected widgetManager: WidgetManager,
        @inject(ILogger) protected logger: ILogger,
        @inject(StorageService) protected storageService: StorageService) { }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand({
            id: 'reset.layout',
            label: 'Reset Workbench Layout'
        }, {
                execute: () => {
                    this.shouldStoreLayout = false;
                    this.storageService.setData(this.storageKey, undefined)
                        .then(() => window.location.reload());
                }
            });
    }

    async initializeLayout(app: FrontendApplication, contributions: FrontendApplicationContribution[]): Promise<void> {
        const serializedLayoutData = await this.storageService.getData<string>(this.storageKey);
        if (serializedLayoutData !== undefined) {
            await this.inflate(serializedLayoutData).then(layoutData => {
                app.shell.setLayoutData(layoutData);
            });
        } else {
            for (const initializer of contributions) {
                if (initializer.initializeLayout) {
                    await initializer.initializeLayout(app);
                }
            }
        }
    }

    storeLayout(app: FrontendApplication): void {
        if (this.shouldStoreLayout) {
            try {
                const layoutData = app.shell.getLayoutData();
                this.storageService.setData(this.storageKey, this.deflate(layoutData));
            } catch (error) {
                this.storageService.setData(this.storageKey, undefined);
                this.logger.error(`Error during serialization of layout data: ${error}`);
            }
        }
    }

    protected isWidgetsProperty(property: string) {
        return property.toLowerCase().endsWith('widgets');
    }

    /**
     * Turns the layout data to a string representation.
     */
    protected deflate(data: ApplicationShell.LayoutData): string {
        return JSON.stringify(data, (property: string, value) => {
            if (this.isWidgetsProperty(property)) {
                const result: WidgetDescription[] = [];
                for (const widget of (value as Widget[])) {
                    const desc = this.widgetManager.getDescription(widget);
                    if (desc) {
                        let innerState = undefined;
                        if (StatefulWidget.is(widget)) {
                            innerState = widget.storeState();
                        }
                        result.push({
                            constructionOptions: desc,
                            innerWidgetState: innerState
                        });
                    }
                }
                return result;
            }
            return value;
        });
    }

    /**
     * Creates the layout data from its string representation.
     */
    protected inflate(layoutData: string): Promise<ApplicationShell.LayoutData> {
        const pending: Promise<void>[] = [];
        const result = JSON.parse(layoutData, (property: string, value) => {
            if (this.isWidgetsProperty(property)) {
                const widgets: Widget[] = [];
                const descs = (value as WidgetDescription[]);
                for (let i = 0; i < descs.length; i++) {
                    const desc = descs[i];
                    if (desc.constructionOptions) {
                        const promise = this.widgetManager.getOrCreateWidget(desc.constructionOptions.factoryId, desc.constructionOptions.options)
                            .then(widget => {
                                if (widget) {
                                    if (StatefulWidget.is(widget) && desc.innerWidgetState !== undefined) {
                                        widget.restoreState(desc.innerWidgetState);
                                    }
                                    widgets[i] = widget;
                                }
                            }).catch(err => {
                                this.logger.warn(`Couldn't restore widget for ${desc}. Error : ${err} `);
                            });
                        pending.push(promise);
                    }
                }
                return widgets;
            }
            return value;
        });
        return Promise.all(pending).then(() => result);
    }

}