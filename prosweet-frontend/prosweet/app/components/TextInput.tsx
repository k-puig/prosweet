export default function TextInput(props: { 
  inputContent: string, 
  onChange: (s: string) => void,
  onKeyPress?: (e: React.KeyboardEvent) => void 
}) {
  const onInput = (event: React.FormEvent<HTMLTextAreaElement>) => {
    const txt = event.currentTarget.value;
    props.onChange(txt);
  }

  return <>
    <textarea 
      className="w-full min-h-[48px] p-3 bg-gray-100 rounded-lg border border-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500 overflow-hidden" 
      value={props.inputContent} 
      onInput={onInput}
      onKeyDown={props.onKeyPress}
      placeholder="Type your message... (Press to send)"
    ></textarea>
  </>
}