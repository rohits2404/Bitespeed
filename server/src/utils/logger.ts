export const logger = {
    info: (message: string, meta?: unknown) => console.log(JSON.stringify({
        level: "info",
        timestamp: new Date().toISOString(),
        message,
        meta,
    })),

    error: (message: string, error?: unknown) => console.error(JSON.stringify({
        level: "error",
        timestamp: new Date().toISOString(),
        message,
        error,
    })),

    warn: (message: string, meta?: any) => {
        console.warn(JSON.stringify({
            level: 'warn',
            timestamp: new Date().toISOString(),
            message,
            ...meta,
        }));
    },

    debug: (message: string, meta?: any) => {
        if (process.env.NODE_ENV === 'development') {
            console.debug(JSON.stringify({
                level: 'debug',
                timestamp: new Date().toISOString(),
                message,
                ...meta,
            }));
        }
    },
};