import { useEffect, useRef } from 'react';

export function useBlurReveal() {
  const elementsRef = useRef<HTMLElement[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px',
      }
    );

    const elements = document.querySelectorAll('.blur-reveal');
    elements.forEach((el) => {
      observer.observe(el);
      elementsRef.current.push(el as HTMLElement);
    });

    return () => {
      elements.forEach((el) => observer.unobserve(el));
      elementsRef.current = [];
    };
  }, []);

  return null;
}
