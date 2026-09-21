import { Helmet } from 'react-helmet-async';

interface SeoProps {
  title: string;
  description: string;
  /** Ảnh đại diện khi chia sẻ (og:image) */
  image?: string;
  /** Đường dẫn tương đối, VD "/san-pham" */
  path?: string;
  type?: 'website' | 'article' | 'product';
  noIndex?: boolean;
}

const SITE_NAME = 'TD Bakugan';

export function Seo({ title, description, image, path, type = 'website', noIndex }: SeoProps) {
  const fullTitle = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;
  const url =
    typeof window !== 'undefined'
      ? `${window.location.origin}${path ?? window.location.pathname}`
      : path;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noIndex && <meta name="robots" content="noindex,nofollow" />}
      {url && <link rel="canonical" href={url} />}

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      {url && <meta property="og:url" content={url} />}
      {image && <meta property="og:image" content={image} />}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
    </Helmet>
  );
}
