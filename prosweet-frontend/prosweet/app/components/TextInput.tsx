export default function TextInput(props: { inputContent: string, onChange: (s:string) => void }) {
  const onInput = (event: React.FormEvent<HTMLTextAreaElement>) => {
    const txt = event.currentTarget.value;
    props.onChange(txt);
  }

  return <>
    <textarea className="m-8 px-5 py-2 text-gray-900 bg-white rounded-md text-sm font-medium hover:bg-gray-300" value={props.inputContent} onInput={onInput}></textarea>
  </>
}