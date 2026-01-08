interface Props {
  content: string;
}

export function AssistantMessage({ content }: Props) {
  return (
    <div className="flex justify-start">
      <div className="bg-gray-100 text-gray-900 rounded-lg px-4 py-2 max-w-[80%] whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}
