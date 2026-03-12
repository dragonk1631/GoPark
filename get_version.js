
const fs = require('fs');
const gnugo = require('c:/Users/drago/Documents/GitHub/GoPark/public/gnugo.js');

const moduleInstance = {
    wasmBinary: fs.readFileSync('c:/Users/drago/Documents/GitHub/GoPark/public/gnugo.wasm'),
    noInitialRun: true,
    onRuntimeInitialized: () => {
        try {
            const version = moduleInstance.ccall('get_version', 'string', [], []);
            console.log('Version:', version);
        } catch(e) {
            console.log('Version failed:', e.message);
        }
        process.exit();
    }
};

gnugo.init(moduleInstance);
