export const AI_DIAGRAM_ANALYSIS_OPEN_MARKER = '[[analysis]]'
export const AI_DIAGRAM_ANALYSIS_CLOSE_MARKER = '[[/analysis]]'
export const AI_DIAGRAM_CHART_OPEN_MARKER = '[[chart]]'
export const AI_DIAGRAM_CHART_CLOSE_MARKER = '[[/chart]]'

export interface ParsedAiDiagramResult {
  analysisMarkdown: string
  chartHtml: string
  hasStructuredOutput: boolean
  chartStarted: boolean
  chartComplete: boolean
}

function trimTrailingPartialMarker(text: string, marker: string) {
  for (let index = marker.length - 1; index > 0; index -= 1) {
    if (text.endsWith(marker.slice(0, index))) {
      return text.slice(0, -index)
    }
  }

  return text
}

function isPartialMarker(text: string, marker: string) {
  const trimmed = text.trim()
  return trimmed.length > 0 && marker.startsWith(trimmed) && trimmed.length < marker.length
}

export function parseAiDiagramResult(raw: string): ParsedAiDiagramResult {
  const result = raw ?? ''
  const analysisOpenIndex = result.indexOf(AI_DIAGRAM_ANALYSIS_OPEN_MARKER)

  if (analysisOpenIndex === -1) {
    return {
      analysisMarkdown: isPartialMarker(result, AI_DIAGRAM_ANALYSIS_OPEN_MARKER)
        ? ''
        : trimTrailingPartialMarker(result, AI_DIAGRAM_ANALYSIS_OPEN_MARKER).trim(),
      chartHtml: '',
      hasStructuredOutput: false,
      chartStarted: false,
      chartComplete: false,
    }
  }

  const analysisStart =
    analysisOpenIndex + AI_DIAGRAM_ANALYSIS_OPEN_MARKER.length
  const analysisCloseIndex = result.indexOf(
    AI_DIAGRAM_ANALYSIS_CLOSE_MARKER,
    analysisStart,
  )

  if (analysisCloseIndex === -1) {
    return {
      analysisMarkdown: trimTrailingPartialMarker(
        result.slice(analysisStart),
        AI_DIAGRAM_ANALYSIS_CLOSE_MARKER,
      ).trim(),
      chartHtml: '',
      hasStructuredOutput: true,
      chartStarted: false,
      chartComplete: false,
    }
  }

  const analysisMarkdown = result
    .slice(analysisStart, analysisCloseIndex)
    .trim()
  const chartMarkerSearch = result.slice(
    analysisCloseIndex + AI_DIAGRAM_ANALYSIS_CLOSE_MARKER.length,
  )
  const chartOpenIndex = chartMarkerSearch.indexOf(AI_DIAGRAM_CHART_OPEN_MARKER)

  if (chartOpenIndex === -1) {
    return {
      analysisMarkdown,
      chartHtml: '',
      hasStructuredOutput: true,
      chartStarted: false,
      chartComplete: false,
    }
  }

  const chartStart =
    chartOpenIndex + AI_DIAGRAM_CHART_OPEN_MARKER.length
  const chartBody = chartMarkerSearch.slice(chartStart)
  const chartCloseIndex = chartBody.indexOf(AI_DIAGRAM_CHART_CLOSE_MARKER)
  const chartHtml = trimTrailingPartialMarker(
    chartCloseIndex === -1
      ? chartBody
      : chartBody.slice(0, chartCloseIndex),
    AI_DIAGRAM_CHART_CLOSE_MARKER,
  )

  return {
    analysisMarkdown,
    chartHtml,
    hasStructuredOutput: true,
    chartStarted: chartHtml.trim().length > 0 || chartCloseIndex !== -1,
    chartComplete: chartCloseIndex !== -1,
  }
}
