const path = require("path");
const alias = require("module-alias");
const Image = require("@11ty/eleventy-img");
const critical = require("eleventy-critical-css");

// Twelvety options can be found in .twelvety.js
// Set up alias for Twelvety options
alias.addAlias("@12ty", path.join(__dirname, ".twelvety"));

// You can now require Twelvety options using @12ty
const twelvety = require("@12ty");

// Filters, transforms and shortcodes can be found in utils
const addFilters = require("./utils/filters");
const addTransforms = require("./utils/transforms");
const addShortcodes = require("./utils/shortcodes");

// Instance of markdown-it
const markdown = require("./utils/markdown");

module.exports = function (config) {
  addFilters(config);
  addTransforms(config);
  addShortcodes(config);
  config.addShortcode('image', imageShortcode);

  // Copy JavaScript files
  config.addPassthroughCopy('./src/_assets/scripts/');

  // Extract and inline critical CSS in production
  // Documentation: https://github.com/gregives/eleventy-critical-css
  if (twelvety.env === "production") {
    config.addPlugin(critical, {
      base: twelvety.dir.output,
    });
  }

  // Deep merge when combining the Data Cascade
  // Documentation: https://www.11ty.dev/docs/data-deep-merge/
  config.setDataDeepMerge(true);

  // Options for LiquidJS
  // Documentation: https://liquidjs.com/tutorials/options.html
  config.setLiquidOptions({
    dynamicPartials: true,
    strict_filters: true,
    strict_variables: true,
  });

  // Set instance of markdown-it so we can add our own plugin
  // Documentation: https://www.11ty.dev/docs/languages/markdown/#add-your-own-plugins
  config.setLibrary("md", markdown);

  return {
    dir: twelvety.dir,
  };
};


// https://github.com/saneef/eleventy-plugin-img2picture
// https://eszter.space/noscript-lazy-load/
// https://www.aleksandrhovhannisyan.com/blog/eleventy-image-lazy-loading/#11ty-image-plugin-in-review
const ImageWidths = {
  ORIGINAL: null,
  PLACEHOLDER: 24,
};

const imageShortcode = async (
  relativeSrc,
  alt,
  widths = [400, 800, 1280],
  baseFormat = 'jpeg',
  optimizedFormats = ['avif', 'webp'],
  sizes = '100vw'
) => {
  const { name: imgName, dir: imgDir } = path.parse(relativeSrc);
  const fullSrc = path.join('src', relativeSrc);

  const imageMetadata = await Image(fullSrc, {
    widths: [ImageWidths.ORIGINAL, ImageWidths.PLACEHOLDER, ...widths],
    formats: [...optimizedFormats, baseFormat],
    filenameFormat: (hash, _src, width, format) => {
      const suffix = width === ImageWidths.PLACEHOLDER ? 'placeholder' : width;
      return `${imgName}-${hash}-${suffix}.${format}`;
    },
    outputDir: path.join('dist', imgDir),
    urlPath: imgDir,
  });

  // Map each unique format (e.g., jpeg, webp) to its smallest and largest images
  const formatSizes = Object.entries(imageMetadata).reduce((formatSizes, [format, images]) => {
    if (!formatSizes[format]) {
      const placeholder = images.find((image) => image.width === ImageWidths.PLACEHOLDER);
      // 11ty sorts the sizes in ascending order under the hood
      const largestVariant = images[images.length - 1];

      formatSizes[format] = {
        placeholder,
        largest: largestVariant,
      };
    }
    return formatSizes;
  }, {});


  // Chain class names w/ the classNames package; optional
  // const picture = `<picture class="${classNames('lazy-picture', className)}"> //removed to use without classNames
  const picture = `<picture class="lazy-picture">
  ${Object.values(imageMetadata)
    // Map each format to the source HTML markup
    .map((formatEntries) => {
      // The first entry is representative of all the others since they each have the same shape
      const { format: formatName, sourceType } = formatEntries[0];

      const placeholderSrcset = formatSizes[formatName].placeholder.url;
      const actualSrcset = formatEntries
        // We don't need the placeholder image in the srcset
        .filter((image) => image.width !== ImageWidths.PLACEHOLDER)
        // All non-placeholder images get mapped to their srcset
        .map((image) => image.srcset)
        .join(', ');

      return `<source type="${sourceType}" srcset="${placeholderSrcset}" data-srcset="${actualSrcset}" data-sizes="${sizes}">`;
    })
    .join('\n')}
    <img
      src="${formatSizes[baseFormat].placeholder.url}"
      data-src="${formatSizes[baseFormat].largest.url}"
      width="${formatSizes[baseFormat].largest.width}"
      height="${formatSizes[baseFormat].largest.height}"
      alt="${alt}"
      class="lazy-img"
      loading="lazy">
  </picture>`;

  return picture;


};
