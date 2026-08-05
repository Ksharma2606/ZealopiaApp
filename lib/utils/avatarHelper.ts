/**
 * Avatar Helper Utility
 *
 * Provides avatar images based on user's pronouns and orientation.
 */

// Import avatar images
const avatarImages = {
  theyThem: require('@/assets/images/avatar/they-them.png'),
  sheStraight: require('@/assets/images/avatar/she-straight.png'),
  sheQueer: require('@/assets/images/avatar/she-queer.png'),
  heStraight: require('@/assets/images/avatar/he-straight.png'),
  heQueer: require('@/assets/images/avatar/he-queer.png'),
};

export type Pronouns = 'He/Him' | 'She/Her' | 'They/Them' | 'Other';
export type Orientation = 'LGBTQ+' | 'Straight' | 'Prefer not to say';

/**
 * Get the appropriate avatar image based on user's pronouns and orientation
 *
 * @param pronouns - User's pronouns (He/Him, She/Her, They/Them, Other)
 * @param orientation - User's sexual orientation (LGBTQ+, Straight, Prefer not to say)
 * @returns The require() image source for the avatar
 */
export function getAvatarImage(pronouns?: string | null, orientation?: string | null): any {
  // Default to they-them for null/undefined values or unknown pronouns
  if (!pronouns) {
    return avatarImages.theyThem;
  }

  const isQueer = orientation === 'LGBTQ+';

  switch (pronouns) {
    case 'He/Him':
      return isQueer ? avatarImages.heQueer : avatarImages.heStraight;

    case 'She/Her':
      return isQueer ? avatarImages.sheQueer : avatarImages.sheStraight;

    case 'They/Them':
    case 'Other':
    default:
      return avatarImages.theyThem;
  }
}

/**
 * Get avatar image for a user object
 * Expects user object with userprofile containing pronouns and orientation
 *
 * @param user - User object with userprofile
 * @returns The require() image source for the avatar
 */
export function getAvatarForUser(user?: {
  userprofile?: {
    pronouns?: string | null;
    orientation?: string | null;
  } | null;
} | null): any {
  return getAvatarImage(
    user?.userprofile?.pronouns,
    user?.userprofile?.orientation
  );
}

export default {
  getAvatarImage,
  getAvatarForUser,
  avatarImages,
};
