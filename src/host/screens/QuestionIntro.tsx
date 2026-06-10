import React from 'react';
import type { QuestionState } from '../../shared/types';
import '../styles/round_intro.css'

interface QuestionProps {
  question?: QuestionState["text"]
}

export function QuestionIntro({question}: QuestionProps): React.JSX.Element {
  return (
    <p>{question}</p>
  )
}
