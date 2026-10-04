import { StoryApp } from "@/components/story-app";
import { SAMPLE_STORY } from "@/lib/sample-story";

export default function HomePage() {
  return <StoryApp sampleStory={SAMPLE_STORY} />;
}
