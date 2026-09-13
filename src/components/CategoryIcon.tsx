import { Component, JSX } from 'solid-js';
import {
  Utensils,
  Coffee,
  Car,
  ShoppingBag,
  Receipt,
  Film,
  Heart,
  Sparkles,
  Home,
  Book,
  Gift,
  Briefcase,
  Smartphone,
  Smile,
  Music,
  Plane,
  MoreHorizontal,
} from 'lucide-solid';

interface CategoryIconProps {
  name: string;
  class?: string;
  style?: JSX.CSSProperties;
}

export const CategoryIcon: Component<CategoryIconProps> = (props) => {
  const iconClass = () => props.class || 'w-4 h-4';

  switch (props.name) {
    case 'Utensils':
      return <Utensils class={iconClass()} style={props.style} />;
    case 'Coffee':
      return <Coffee class={iconClass()} style={props.style} />;
    case 'Car':
      return <Car class={iconClass()} style={props.style} />;
    case 'ShoppingBag':
      return <ShoppingBag class={iconClass()} style={props.style} />;
    case 'Receipt':
      return <Receipt class={iconClass()} style={props.style} />;
    case 'Film':
      return <Film class={iconClass()} style={props.style} />;
    case 'Heart':
      return <Heart class={iconClass()} style={props.style} />;
    case 'Sparkles':
      return <Sparkles class={iconClass()} style={props.style} />;
    case 'Home':
      return <Home class={iconClass()} style={props.style} />;
    case 'Book':
      return <Book class={iconClass()} style={props.style} />;
    case 'Gift':
      return <Gift class={iconClass()} style={props.style} />;
    case 'Briefcase':
      return <Briefcase class={iconClass()} style={props.style} />;
    case 'Smartphone':
      return <Smartphone class={iconClass()} style={props.style} />;
    case 'Smile':
      return <Smile class={iconClass()} style={props.style} />;
    case 'Music':
      return <Music class={iconClass()} style={props.style} />;
    case 'Plane':
      return <Plane class={iconClass()} style={props.style} />;
    default:
      return <MoreHorizontal class={iconClass()} style={props.style} />;
  }
};
