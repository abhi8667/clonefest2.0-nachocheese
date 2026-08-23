import React from 'react';

interface FeatureCard {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface FeatureHighlightsProps {
  cards: FeatureCard[];
  title?: string;
}

export const FeatureHighlights: React.FC<FeatureHighlightsProps> = ({ cards, title }) => {
  return (
    <div className="mt-10">
      {title && (
        <div className="flex items-center gap-3 mb-5">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
          <span className="text-xs font-mono uppercase tracking-widest text-slate-500">{title}</span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <div key={i} className="feature-card">
            <div className="feature-card-icon">
              {card.icon}
            </div>
            <h4 className="text-sm font-semibold text-slate-200 mb-1">{card.title}</h4>
            <p className="text-xs text-slate-500 leading-relaxed">{card.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
