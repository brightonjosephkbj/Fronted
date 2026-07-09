import { CardStyleInterpolators } from '@react-navigation/stack';

export const slideFromRight = {
  cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
};

export const slideFromBottom = {
  cardStyleInterpolator: CardStyleInterpolators.forVerticalIOS,
  gestureDirection: 'vertical',
};

export const fadeTransition = {
  cardStyleInterpolator: CardStyleInterpolators.forFadeFromCenter,
};
