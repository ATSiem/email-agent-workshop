import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generates a random 3-word token for version tracking
 * Words are simple adjectives and nouns that are easy to remember
 */
export function generateVersionToken(): string {
  const adjectives = [
    'red', 'blue', 'green', 'happy', 'swift', 'calm', 'bold', 
    'brave', 'wise', 'kind', 'cool', 'warm', 'soft', 'wild'
  ];
  
  const nouns = [
    'fox', 'bear', 'wolf', 'moon', 'star', 'sun', 'tree', 
    'lake', 'bird', 'fish', 'rock', 'wind', 'rain', 'snow'
  ];
  
  const verbs = [
    'runs', 'jumps', 'flies', 'swims', 'sings', 'dances', 'glows',
    'grows', 'falls', 'rises', 'flows', 'shines', 'moves', 'sleeps'
  ];
  
  const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
  const randomVerb = verbs[Math.floor(Math.random() * verbs.length)];
  
  return `${randomAdjective}-${randomNoun}-${randomVerb}`;
}
