import bannerUrl from '../assets/i2d-banner.jpg';
import logoUrl from '../assets/i2d-logo.svg';

/** Briefkopf-Banner von Innovation2Didactics (enthält Logo und Wortmarke). */
export function Banner() {
  return <img class="banner" src={bannerUrl} width={1800} height={343} alt="Innovation2Didactics" />;
}

/** Rundes i2d-Logo. */
export function Logo({ size = 32 }: { size?: number }) {
  return <img class="logo" src={logoUrl} width={size} height={size} alt="i2d" />;
}
