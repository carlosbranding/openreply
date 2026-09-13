import { defineRailway, github, postgres, project, redis, service, volume } from "railway/iac";

export default defineRailway(() => {
  const Postgres = postgres("Postgres", { region: "sfo" });
  Postgres.networking = { privateNetworkEndpoint: "postgres" };
  const Redis = redis("Redis", { region: "sfo" });
  Redis.deploy = { startCommand: "/bin/sh -c \"rm -rf $RAILWAY_VOLUME_MOUNT_PATH/lost+found/ && exec docker-entrypoint.sh redis-server --requirepass $REDIS_PASSWORD --save 60 1 --dir $RAILWAY_VOLUME_MOUNT_PATH\"" };
  Redis.networking = { privateNetworkEndpoint: "redis" };
  const redisVolume = volume("redis-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "sfo", sizeMB: 500 });
  const postgresVolume = volume("postgres-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "sfo", sizeMB: 500 });

  // Always-on BullMQ worker: sends the DMs, consumes the Redis queue.
  // Secrets (NEXTAUTH_SECRET, ENCRYPTION_KEY, INSTAGRAM_*, etc.) are set
  // separately via `railway variable set` so they never land in this file.
  const worker = service("worker", {
    source: github("carlosbranding/openreply"),
    build: "npm run db:generate",
    start: "npm run worker",
    variables: {
      DATABASE_URL: Postgres.env.DATABASE_URL,
      REDIS_URL: Redis.env.REDIS_URL,
    },
  });

  return project("openreply", {
    resources: [Postgres, Redis, redisVolume, postgresVolume, worker],
  });
});
