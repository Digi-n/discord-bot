"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBankerOrManagement = exports.canUpdateStock = exports.isManagement = exports.hasRole = void 0;
const config_1 = require("../config");
const hasRole = (member, roleName) => {
    return member.roles.cache.some(role => role.name === roleName);
};
exports.hasRole = hasRole;
const isManagement = (member) => {
    return (0, exports.hasRole)(member, config_1.CONFIG.ROLES.MANAGEMENT);
};
exports.isManagement = isManagement;
const canUpdateStock = (member) => {
    const allowed = [
        config_1.CONFIG.ROLES.MANAGEMENT,
        config_1.CONFIG.ROLES.GROWER,
        config_1.CONFIG.ROLES.COOK,
        config_1.CONFIG.ROLES.DISTRIBUTOR
    ];
    return allowed.some(role => (0, exports.hasRole)(member, role));
};
exports.canUpdateStock = canUpdateStock;
const isBankerOrManagement = (member) => {
    return (0, exports.hasRole)(member, config_1.CONFIG.ROLES.BANKER) || (0, exports.hasRole)(member, config_1.CONFIG.ROLES.MANAGEMENT);
};
exports.isBankerOrManagement = isBankerOrManagement;
