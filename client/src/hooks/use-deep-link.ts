import { useEffect } from 'react';
import { useLocation } from 'wouter';

interface DeepLinkRoute {
  pattern: RegExp;
  handler: (matches: RegExpMatchArray, setLocation: (path: string) => void) => void;
}

const deepLinkRoutes: DeepLinkRoute[] = [
  {
    pattern: /^recipal:\/\/recipe\/(.+)$/,
    handler: (matches, setLocation) => {
      setLocation(`/recipe/${matches[1]}`);
    },
  },
  {
    pattern: /^recipal:\/\/planner$/,
    handler: (_, setLocation) => {
      setLocation('/plan');
    },
  },
  {
    pattern: /^recipal:\/\/cart$/,
    handler: (_, setLocation) => {
      setLocation('/cart');
    },
  },
  {
    pattern: /^recipal:\/\/paywall$/,
    handler: (_, setLocation) => {
      setLocation('/paywall');
    },
  },
  {
    pattern: /^recipal:\/\/profile$/,
    handler: (_, setLocation) => {
      setLocation('/profile');
    },
  },
  {
    pattern: /^recipal:\/\/settings$/,
    handler: (_, setLocation) => {
      setLocation('/settings');
    },
  },
  {
    pattern: /^recipal:\/\/preferences$/,
    handler: (_, setLocation) => {
      setLocation('/preferences');
    },
  },
  {
    pattern: /^recipal:\/\/instacart$/,
    handler: (_, setLocation) => {
      setLocation('/instacart');
    },
  },
];

export function useDeepLink() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const handleDeepLink = (url: string) => {
      console.log('[DeepLink] Handling:', url);
      
      for (const route of deepLinkRoutes) {
        const matches = url.match(route.pattern);
        if (matches) {
          route.handler(matches, setLocation);
          return true;
        }
      }
      
      console.log('[DeepLink] No matching route for:', url);
      return false;
    };

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const deepLink = urlParams.get('deeplink');
      if (deepLink) {
        handleDeepLink(deepLink);
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }

    const handleCustomEvent = (event: CustomEvent<{ url: string }>) => {
      handleDeepLink(event.detail.url);
    };

    window.addEventListener('recipal-deeplink' as any, handleCustomEvent as EventListener);

    return () => {
      window.removeEventListener('recipal-deeplink' as any, handleCustomEvent as EventListener);
    };
  }, [setLocation]);
}

export function triggerDeepLink(url: string) {
  const event = new CustomEvent('recipal-deeplink', { detail: { url } });
  window.dispatchEvent(event);
}

export function parseDeepLink(url: string): { route: string; params: Record<string, string> } | null {
  for (const route of deepLinkRoutes) {
    const matches = url.match(route.pattern);
    if (matches) {
      return {
        route: url.replace('recipal://', '/'),
        params: {},
      };
    }
  }
  return null;
}

export function createShareableRecipeUrl(recipeId: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/share/recipe/${recipeId}`;
  }
  return `/share/recipe/${recipeId}`;
}

export function createDeepLink(route: 'recipe' | 'planner' | 'cart' | 'paywall' | 'profile' | 'instacart', id?: string): string {
  switch (route) {
    case 'recipe':
      return `recipal://recipe/${id}`;
    case 'planner':
      return 'recipal://planner';
    case 'cart':
      return 'recipal://cart';
    case 'paywall':
      return 'recipal://paywall';
    case 'profile':
      return 'recipal://profile';
    case 'instacart':
      return 'recipal://instacart';
  }
}
