package com.hwc.knowledge.parse;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class TextSegmenter {

    private static final Pattern CHAPTER_PATTERN =
            Pattern.compile("^(第[一二三四五六七八九十百0-9]+[章节部分篇]|[0-9]+(\\.[0-9]+)*\\s+\\S+).*$",
                    Pattern.MULTILINE);

    private final int chunkSize;
    private final int overlap;

    public TextSegmenter(int chunkSize, int overlap) {
        this.chunkSize = Math.max(100, chunkSize);
        this.overlap = Math.min(Math.max(0, overlap), this.chunkSize / 2);
    }

    public List<Segment> segment(String text) {
        List<Segment> segments = new ArrayList<>();
        if (text == null || text.isBlank()) {
            return segments;
        }
        String normalized = text.replace("\r\n", "\n").trim();

        List<ChapterBound> bounds = new ArrayList<>();
        Matcher matcher = CHAPTER_PATTERN.matcher(normalized);
        while (matcher.find()) {
            bounds.add(new ChapterBound(matcher.start(), matcher.group(1).trim()));
        }

        if (bounds.isEmpty()) {
            segments.addAll(splitBySize(normalized, null));
            return segments;
        }
        if (bounds.get(0).start() > 0) {
            String preamble = normalized.substring(0, bounds.get(0).start()).trim();
            segments.addAll(splitBySize(preamble, null));
        }
        for (int i = 0; i < bounds.size(); i++) {
            ChapterBound bound = bounds.get(i);
            int end = i + 1 < bounds.size() ? bounds.get(i + 1).start() : normalized.length();
            String chapterText = normalized.substring(bound.start(), end).trim();
            segments.addAll(splitBySize(chapterText, bound.chapter()));
        }
        return segments;
    }

    private List<Segment> splitBySize(String text, String chapter) {
        List<Segment> segments = new ArrayList<>();
        if (text == null || text.isBlank()) {
            return segments;
        }
        int start = 0;
        while (start < text.length()) {
            int end = Math.min(start + chunkSize, text.length());
            if (end < text.length()) {
                int lastBreak = Math.max(Math.max(
                        text.lastIndexOf('\n', end),
                        text.lastIndexOf('。', end)),
                        text.lastIndexOf('；', end));
                if (lastBreak > start + chunkSize / 2) {
                    end = lastBreak + 1;
                }
            }
            String content = text.substring(start, end).trim();
            if (!content.isEmpty()) {
                segments.add(new Segment(segments.size() + 1, content, chapter, content.length()));
            }
            if (end >= text.length()) {
                break;
            }
            start = Math.max(end - overlap, start + 1);
        }
        return segments;
    }

    private record ChapterBound(int start, String chapter) {
    }

    @Data
    @AllArgsConstructor
    public static class Segment {

        private int seqNo;
        private String content;
        private String chapter;
        private int charCount;
    }
}