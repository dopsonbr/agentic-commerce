interface Props {
  content: string;
}

export function UserMessage({ content }: Props) {
  return (
    <div className="flex justify-end">
      <div className="bg-blue-500 text-white rounded-lg px-4 py-2 max-w-[80%]">
        {content}
      </div>
    </div>
  );
}
