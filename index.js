require("dotenv").config();
const csv = require("csvtojson");
const Listr = require("listr");
const sdk = require("@zesty-io/sdk");
const fs = require("fs");
const path = require("path");

(() => {
  const zestySDK = new sdk(
    process.env.INSTANCE_ZUID,
    process.env.SESSION_TOKEN
  );

  const fileExtension = ["jpg", "jpeg", "png", "gif", "svg", "webp", "ico"];
  const dirPath = "./image";
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath);
  }
  const uploadImage = (imageUrl, bin, instance, filename) =>
    fetch(imageUrl)
      .then((res) => res.arrayBuffer())
      .then(async (arrayBuffer) => {
        let buffer = Buffer.from(arrayBuffer);
        const ext = imageUrl
          .split("/")
          .pop()
          .split(/[#?]/)[0]
          .split(".")
          .pop()
          .trim();
        const file =
          filename + "." + (fileExtension.includes(ext) ? ext : "jpg");

        fs.writeFileSync(path.join(dirPath, file), buffer);

        const stream = fs.createReadStream(path.join(dirPath, file));

        const image = await zestySDK.media.createFile(bin.id, stream, {
          title: filename,
          fileName: file,
        });

        fs.unlinkSync(path.join(dirPath, file));

        return image?.data?.[0]?.id;
      })
      .catch((e) => null);

  const tasks = new Listr([
    {
      title: "Collecting content items data...",
      task: async (ctx) => {
        const content = await csv().fromFile(process.env.FILE_LOCATION);
        ctx.contents = content;
      },
    },
    {
      title: "Checking instance...",
      task: async (ctx) => {
        const instance = await zestySDK.account.getInstance();

        if (instance.error) {
          throw new Error(instance.error);
        }

        const bins = await zestySDK.media.getBins();

        if (bins.error) {
          throw new Error(bins.error);
        }

        const bin = bins.data.find(
          (bin) => bin.name === `zesty-${instance.data.name.toLowerCase()}`
        );

        const parentZUID = await zestySDK.instance
          .getItems(ctx.parentZUID)
          .then((res) => res.data?.[0].meta.ZUID);

        ctx.instance = instance.data;
        ctx.parentZUID = parentZUID || "";
        ctx.bin = bin;
      },
    },
    {
      title: "Setting up schema..",
      skip: (ctx) => {
        if (ctx.modelZUID !== "") return "Model ZUID has been assigned..";
      },
      task: async (ctx) => {
        const schema = require("./schema.json");
        const model = await zestySDK.instance.createModel({
          label: schema.label,
          name: schema.name,
          parentZUID: ctx.parentZUID,
          type: schema.type,
        });

        if (model.error) {
          throw new Error(model.error);
        }

        ctx.modelZUID = model.data.ZUID;
      },
    },
    {
      title: "Creating fields..",
      task: async (ctx) => {
        const schema = require("./schema.json");
        for (const field of schema.fields) {
          await zestySDK.instance.createField(ctx.modelZUID, field);
        }
      },
    },
    {
      title: "Creating content items..",
      task: async (ctx) => {
        for (const content of ctx.contents) {
          const pathPath = content["Name"]
            .replaceAll("&", "and")
            .replace(/[^a-zA-Z ]/g, "")
            .replaceAll(" ", "-")
            .toLowerCase();
          const background = await uploadImage(
            content["Background image related to non-profit"],
            ctx.bin,
            ctx.instance,
            `bg-${pathPath}`
          );
          const logo = await uploadImage(
            content["Logo URL"],
            ctx.bin,
            ctx.instance,
            `logo-${pathPath}`
          );

          await zestySDK.instance.upsertItem(ctx.modelZUID, pathPath, {
            data: {
              name: content["Name"],
              phone_number: content["Phone Number"],
              headquarters_address: content["Headquarters Address"],
              organization_type: content["Organization Type"],
              cause_description: content["NPO Page Description"],
              website: content["Website URL"],
              donate_link: content["Donation Link on Website"],
              hero_image: background,
              logo: logo,
            },
            web: {
              canonicalTagMode: 1,
              parentZUID: ctx.parentZUID,
              metaLinkText: content["SEO Meta Title"],
              metaTitle: content["SEO Meta Title"],
              pathPart: pathPath,
              metaDescription: content["SEO Meta Description"],
            },
            meta: {
              langID: 1,
              contentModelZUID: ctx.modelZUID,
            },
          });
        }
      },
    },
    {
      title: "Publishing contents",
      task: async (ctx) => {
        const contents = await zestySDK.instance.getItems(ctx.modelZUID);
        for (const content of contents.data) {
          await zestySDK.instance.publishItem(
            ctx.modelZUID,
            content.meta.ZUID,
            content.meta.version
          );
        }
      },
    },
  ]);

  tasks
    .run({
      zuid: process.env.INSTANCE_ZUID,
      parentZUID: process.env.PARENT_ZUID,
      token: process.env.SESSION_TOKEN,
      modelZUID: process.env.MODEL_ZUID,
    })
    .catch((err) => {});
})();
