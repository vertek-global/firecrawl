"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const systeminformation_1 = __importDefault(require("systeminformation"));
const async_mutex_1 = require("async-mutex");
const os_1 = __importDefault(require("os"));
const fs_1 = __importDefault(require("fs"));
const logger_1 = require("../lib/logger");
const IS_KUBERNETES = process.env.IS_KUBERNETES === "true";
const MAX_CPU = process.env.MAX_CPU ? parseFloat(process.env.MAX_CPU) : 0.8;
const MAX_RAM = process.env.MAX_RAM ? parseFloat(process.env.MAX_RAM) : 0.8;
const CACHE_DURATION = process.env.SYS_INFO_MAX_CACHE_DURATION
    ? parseFloat(process.env.SYS_INFO_MAX_CACHE_DURATION)
    : 150;
class SystemMonitor {
    static instance;
    static instanceMutex = new async_mutex_1.Mutex();
    cpuUsageCache = null;
    memoryUsageCache = null;
    lastCpuCheck = 0;
    lastMemoryCheck = 0;
    // Variables for CPU usage calculation
    previousCpuUsage = 0;
    previousTime = Date.now();
    constructor() { }
    static async getInstance() {
        if (SystemMonitor.instance) {
            return SystemMonitor.instance;
        }
        await this.instanceMutex.runExclusive(async () => {
            if (!SystemMonitor.instance) {
                SystemMonitor.instance = new SystemMonitor();
            }
        });
        return SystemMonitor.instance;
    }
    async checkMemoryUsage() {
        if (IS_KUBERNETES) {
            return this._checkMemoryUsageKubernetes();
        }
        return this._checkMemoryUsage();
    }
    readMemoryCurrent() {
        const data = fs_1.default.readFileSync("/sys/fs/cgroup/memory.current", "utf8");
        return parseInt(data.trim(), 10);
    }
    readMemoryMax() {
        const data = fs_1.default.readFileSync("/sys/fs/cgroup/memory.max", "utf8").trim();
        if (data === "max") {
            return Infinity;
        }
        return parseInt(data, 10);
    }
    async _checkMemoryUsageKubernetes() {
        try {
            const currentMemoryUsage = this.readMemoryCurrent();
            const memoryLimit = this.readMemoryMax();
            let memoryUsagePercentage;
            if (memoryLimit === Infinity) {
                // No memory limit set; use total system memory
                const totalMemory = os_1.default.totalmem();
                memoryUsagePercentage = currentMemoryUsage / totalMemory;
            }
            else {
                memoryUsagePercentage = currentMemoryUsage / memoryLimit;
            }
            // console.log("Memory usage:", memoryUsagePercentage);
            return memoryUsagePercentage;
        }
        catch (error) {
            logger_1.logger.error(`Error calculating memory usage: ${error}`);
            return 0; // Fallback to 0% usage
        }
    }
    async _checkMemoryUsage() {
        const now = Date.now();
        if (this.memoryUsageCache !== null &&
            now - this.lastMemoryCheck < CACHE_DURATION) {
            return this.memoryUsageCache;
        }
        const memoryData = await systeminformation_1.default.mem();
        const totalMemory = memoryData.total;
        const availableMemory = memoryData.available;
        const usedMemory = totalMemory - availableMemory;
        const usedMemoryPercentage = usedMemory / totalMemory;
        this.memoryUsageCache = usedMemoryPercentage;
        this.lastMemoryCheck = now;
        return usedMemoryPercentage;
    }
    async checkCpuUsage() {
        if (IS_KUBERNETES) {
            return this._checkCpuUsageKubernetes();
        }
        return this._checkCpuUsage();
    }
    readCpuUsage() {
        const data = fs_1.default.readFileSync("/sys/fs/cgroup/cpu.stat", "utf8");
        const match = data.match(/^usage_usec (\d+)$/m);
        if (match) {
            return parseInt(match[1], 10);
        }
        throw new Error("Could not read usage_usec from cpu.stat");
    }
    getNumberOfCPUs() {
        let cpus = [];
        try {
            const cpusetPath = "/sys/fs/cgroup/cpuset.cpus.effective";
            const data = fs_1.default.readFileSync(cpusetPath, "utf8").trim();
            if (!data) {
                throw new Error(`${cpusetPath} is empty.`);
            }
            cpus = this.parseCpuList(data);
            if (cpus.length === 0) {
                throw new Error("No CPUs found in cpuset.cpus.effective");
            }
        }
        catch (error) {
            logger_1.logger.warn(`Unable to read cpuset.cpus.effective, defaulting to OS CPUs: ${error}`);
            cpus = os_1.default.cpus().map((cpu, index) => index);
        }
        return cpus.length;
    }
    parseCpuList(cpuList) {
        const ranges = cpuList.split(",");
        const cpus = [];
        ranges.forEach((range) => {
            const [startStr, endStr] = range.split("-");
            const start = parseInt(startStr, 10);
            const end = endStr !== undefined ? parseInt(endStr, 10) : start;
            for (let i = start; i <= end; i++) {
                cpus.push(i);
            }
        });
        return cpus;
    }
    async _checkCpuUsageKubernetes() {
        try {
            const usage = this.readCpuUsage(); // In microseconds (µs)
            const now = Date.now();
            // Check if it's the first run
            if (this.previousCpuUsage === 0) {
                // Initialize previous values
                this.previousCpuUsage = usage;
                this.previousTime = now;
                // Return 0% CPU usage on first run
                return 0;
            }
            const deltaUsage = usage - this.previousCpuUsage; // In µs
            const deltaTime = (now - this.previousTime) * 1000; // Convert ms to µs
            const numCPUs = this.getNumberOfCPUs(); // Get the number of CPUs
            // Calculate the CPU usage percentage and normalize by the number of CPUs
            const cpuUsagePercentage = deltaUsage / deltaTime / numCPUs;
            // Update previous values
            this.previousCpuUsage = usage;
            this.previousTime = now;
            // console.log("CPU usage:", cpuUsagePercentage);
            return cpuUsagePercentage;
        }
        catch (error) {
            logger_1.logger.error(`Error calculating CPU usage: ${error}`);
            return 0; // Fallback to 0% usage
        }
    }
    async _checkCpuUsage() {
        const now = Date.now();
        if (this.cpuUsageCache !== null &&
            now - this.lastCpuCheck < CACHE_DURATION) {
            return this.cpuUsageCache;
        }
        const cpuData = await systeminformation_1.default.currentLoad();
        const cpuLoad = cpuData.currentLoad / 100;
        this.cpuUsageCache = cpuLoad;
        this.lastCpuCheck = now;
        return cpuLoad;
    }
    async acceptConnection() {
        const cpuUsage = await this.checkCpuUsage();
        const memoryUsage = await this.checkMemoryUsage();
        return cpuUsage < MAX_CPU && memoryUsage < MAX_RAM;
    }
    clearCache() {
        this.cpuUsageCache = null;
        this.memoryUsageCache = null;
        this.lastCpuCheck = 0;
        this.lastMemoryCheck = 0;
    }
}
exports.default = SystemMonitor.getInstance();
//# sourceMappingURL=system-monitor.js.map