"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.authenticateJwt = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const prisma_1 = __importDefault(require("../prisma"));
// Import the blacklist check dynamically to avoid circular dependency
let isTokenBlacklisted = null;
const getBlacklistChecker = async () => {
    if (!isTokenBlacklisted) {
        const authRoutes = await Promise.resolve().then(() => __importStar(require('../routes/auth.routes')));
        isTokenBlacklisted = authRoutes.isTokenBlacklisted;
    }
    return isTokenBlacklisted;
};
const authenticateJwt = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Authentication required. Please provide a Bearer token.' },
        });
    }
    const token = authHeader.split(' ')[1];
    // ─── Check token blacklist ─────────────────────────────────
    try {
        const checker = await getBlacklistChecker();
        if (checker && checker(token)) {
            return res.status(401).json({
                success: false,
                error: { code: 'TOKEN_REVOKED', message: 'This token has been revoked. Please log in again.' },
            });
        }
    }
    catch {
        // If blacklist check fails, continue (fail-open for availability)
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, env_1.ENV.JWT_SECRET);
        // Check if user still exists and is active
        const user = await prisma_1.default.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, email: true, role: true, status: true },
        });
        // Active and inactive accounts can sign in and deposit. Closed accounts cannot.
        const canUseAccount = user && (user.status === 'active' || user.status === 'inactive' || user.status === 'suspended');
        if (!canUseAccount) {
            return res.status(401).json({
                success: false,
                error: { code: 'USER_INACTIVE', message: 'User account is closed or not found.' },
            });
        }
        req.user = { id: user.id, email: user.email, role: user.role };
        next();
    }
    catch {
        return res.status(401).json({
            success: false,
            error: { code: 'INVALID_TOKEN', message: 'Token is invalid or expired.' },
        });
    }
};
exports.authenticateJwt = authenticateJwt;
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
            });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: { code: 'FORBIDDEN', message: 'Insufficient privileges to access this resource.' },
            });
        }
        next();
    };
};
exports.requireRole = requireRole;
