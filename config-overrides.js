module.exports = function override(config, env) {
    // Ajouter un fallback pour 'crypto'
    config.resolve.fallback = {
        ...config.resolve.fallback, // pour garder les fallbacks existants
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),

    };
    return config;
};



