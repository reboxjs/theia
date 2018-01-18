/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import URI from "@theia/core/lib/common/uri";
import {
    injectable
} from "inversify";

@injectable()
export class DiffUriLabelProviderContribution {

    canHandle(element: object): number {
        return 0;
    }

    getIcon(uri: URI): string {
        return `fa fa-columns`;
    }
}
