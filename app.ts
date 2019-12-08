import * as fs from 'fs';
import * as process from 'process';

import { Warehouse } from './warehouse.js';
import { Configuration } from './configuration.js';

function readConfiguration(): Configuration {
    const configurationJson = fs.readFileSync('configuration.json', 'utf8');
    const configuration = <Configuration>JSON.parse(configurationJson);
    return configuration;
}

async function startWarehouse() {
    try {
        const configuration = readConfiguration();
        const warehouse = new Warehouse(configuration);
        await warehouse.start();
    }
    catch (error) {
        console.error(error);
        process.exit(1);
    }
}

startWarehouse();