/** @type {import('typeorm/driver/mysql/MysqlConnectionOptions').MysqlConnectionOptions} */
module.exports = {
    type: "mariadb",
    host: "db",
    port: 3306,
    username: "db",
    password: "db",
    database: "db",
    charset: "utf8mb4",
    // timezone: '+00:00',
    synchronize: false,
    logging: false,
    entities: [
        "lib/src/entity/**/*.js"
    ],
    migrations: [
        "lib/src/migration/**/*.js"
    ],
    subscribers: [
        "lib/src/subscriber/**/*.js"
    ],
    supportBigNumbers: true,
    bigNumberStrings: true,
    extra: {
        connectionLimit: Number(process.env.APP_DB_CONNECTION_LIMIT || 4),
    },
};
