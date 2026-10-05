import packageInfo from "../package.json";

/** The version shown on the menu: the one of package.json, bumped with every patch. */
export const APP_VERSION: string = packageInfo.version;
