module.exports = function override(config, env) {

    config.resolve.fallback = {
        ...config.resolve.fallback, // pour garder les fallbacks existants qui sont surement (j'en suis sur à quasi 100% ) inclus dans create-react-app
        crypto: require.resolve('crypto-browserify'), // jaurai plus les warning liés à bcrypt
        stream: require.resolve('stream-browserify'), //...

    };
    return config;
};