import { NextResponse } from "next/server";

/**
 * GET /api/wordpress
 *
 * Returns a JSON object containing 20 mock WordPress URLs.
 * These represent typical WordPress installations found via
 * common path signatures such as /wp-content/, /wp-login.php,
 * /wp-admin/, and /wp-json/.
 *
 * In a real Phase 2 implementation this route would query an
 * external indexed data source (e.g. Common Crawl, Bing, etc.)
 * and stream/paginate results. For Phase 1 we return static data.
 */
export async function GET() {
  const urls: string[] = [
    "https://techblog-daily.com/wp-content/themes/astra/",
    "https://myfoodblog.net/wp-login.php",
    "https://creativestudio.io/wp-admin/",
    "https://localmarketing.biz/wp-json/wp/v2/posts",
    "https://healthyrecipes.org/wp-content/uploads/2024/hero.jpg",
    "https://sportsnews247.com/wp-content/plugins/jetpack/",
    "https://fashiontrends.co/wp-login.php",
    "https://digitalagencyxyz.com/wp-admin/admin-ajax.php",
    "https://smallbizowner.net/wp-content/themes/divi/",
    "https://travelblogger.me/wp-json/wp/v2/pages",
    "https://photographyfolio.com/wp-content/uploads/gallery/",
    "https://realestatepro.biz/wp-login.php",
    "https://codecorner.dev/wp-admin/",
    "https://musicreviewhub.com/wp-content/themes/twentytwentyfour/",
    "https://veganlifestyle.net/wp-json/wp/v2/categories",
    "https://fitnesscoachpro.com/wp-content/plugins/woocommerce/",
    "https://artgalleryonline.com/wp-login.php",
    "https://startupinsights.co/wp-admin/edit.php",
    "https://petcareguide.org/wp-content/themes/generatepress/",
    "https://newsportal-world.com/wp-json/wp/v2/media",
  ];

  return NextResponse.json({ urls });
}
