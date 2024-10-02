/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "ffmpeg-astro",
      providers: {
        aws: {
          profile: input?.stage === "production" ? "FMEprod" : "FMEdev",
          region: "us-east-2"
        },
      },
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
    };
  },
  async run() {
    new sst.aws.Astro("MyWeb");
  },
});
