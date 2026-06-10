import React from 'react';
import type { QuestionState } from '../../shared/types';
import '../styles/round_intro.css'

interface QuestionProps {
  question?: QuestionState["text"]
}

export function QuestionIntro({question}: QuestionProps): React.JSX.Element {
  return (
    <main className="round-intro">
      <div className="round-intro-card">
        <p className="round-intro-eyebrow">Get ready…</p>
        <h1 className="round-intro-title">
          {question}
        </h1>
      </div>
    </main>
  )
}
