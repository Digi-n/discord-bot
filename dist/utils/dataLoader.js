"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveNameLocks = exports.loadNameLocks = exports.saveStockData = exports.loadStockData = exports.saveBankData = exports.loadBankData = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config");
const resolvePath = (filename) => path_1.default.join(process.cwd(), filename);
// GENERIC LOAD/SAVE
function loadData(filename, defaultData) {
    const filePath = resolvePath(filename);
    if (fs_1.default.existsSync(filePath)) {
        try {
            const data = fs_1.default.readFileSync(filePath, 'utf-8');
            return JSON.parse(data);
        }
        catch (e) {
            console.error(`Error loading ${filename}:`, e);
            return defaultData;
        }
    }
    return defaultData;
}
function saveData(filename, data) {
    const filePath = resolvePath(filename);
    try {
        fs_1.default.writeFileSync(filePath, JSON.stringify(data, null, 4));
    }
    catch (e) {
        console.error(`Error saving ${filename}:`, e);
    }
}
// SPECIFIC FUNCTIONS
const loadBankData = () => loadData(config_1.CONFIG.FILES.BANK_DATA, { black_balance: 0 });
exports.loadBankData = loadBankData;
const saveBankData = (data) => saveData(config_1.CONFIG.FILES.BANK_DATA, data);
exports.saveBankData = saveBankData;
const loadStockData = () => loadData(config_1.CONFIG.FILES.STOCK_DATA, { weed: 0, meth: 0, distribution: 0 });
exports.loadStockData = loadStockData;
const saveStockData = (data) => saveData(config_1.CONFIG.FILES.STOCK_DATA, data);
exports.saveStockData = saveStockData;
const loadNameLocks = () => loadData(config_1.CONFIG.FILES.NAME_LOCKS, {});
exports.loadNameLocks = loadNameLocks;
const saveNameLocks = (data) => saveData(config_1.CONFIG.FILES.NAME_LOCKS, data);
exports.saveNameLocks = saveNameLocks;
