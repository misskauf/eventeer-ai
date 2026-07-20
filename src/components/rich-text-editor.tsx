import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Minus,
  Link as LinkIcon,
  Image as ImageIcon,
  Undo,
  Redo,
  Pilcrow,
  LayoutTemplate,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CONTRACT_PLACEHOLDERS } from "@/lib/contracts";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
};

function ToolBtn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon"
      className="h-8 w-8"
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </Button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-1 py-1">
      <ToolBtn
        title="Paragraph"
        onClick={() => editor.chain().focus().setParagraph().run()}
        active={editor.isActive("paragraph")}
      >
        <Pilcrow className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        title="Heading 1"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive("heading", { level: 1 })}
      >
        <Heading1 className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        title="Heading 2"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })}
      >
        <Heading2 className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        title="Heading 3"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive("heading", { level: 3 })}
      >
        <Heading3 className="h-4 w-4" />
      </ToolBtn>
      <span className="mx-1 h-5 w-px bg-border" />
      <ToolBtn
        title="Bold"
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
      >
        <Bold className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        title="Italic"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
      >
        <Italic className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        title="Underline"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive("underline")}
      >
        <UnderlineIcon className="h-4 w-4" />
      </ToolBtn>
      <span className="mx-1 h-5 w-px bg-border" />
      <ToolBtn
        title="Bullet list"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
      >
        <List className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        title="Numbered list"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
      >
        <ListOrdered className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        title="Section divider"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus className="h-4 w-4" />
      </ToolBtn>
      <span className="mx-1 h-5 w-px bg-border" />
      <ToolBtn
        title="Add link"
        onClick={() => {
          const url = window.prompt("URL", editor.getAttributes("link").href ?? "https://");
          if (url === null) return;
          if (url === "") {
            editor.chain().focus().unsetLink().run();
          } else {
            editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
          }
        }}
        active={editor.isActive("link")}
      >
        <LinkIcon className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn
        title="Insert image (URL)"
        onClick={() => {
          const url = window.prompt("Image URL");
          if (url) editor.chain().focus().setImage({ src: url }).run();
        }}
      >
        <ImageIcon className="h-4 w-4" />
      </ToolBtn>
      <span className="mx-1 h-5 w-px bg-border" />
      <ToolBtn title="Undo" onClick={() => editor.chain().focus().undo().run()}>
        <Undo className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn title="Redo" onClick={() => editor.chain().focus().redo().run()}>
        <Redo className="h-4 w-4" />
      </ToolBtn>
      <div className="ml-auto">
        <Select
          value=""
          onValueChange={(key) => {
            if (!key) return;
            editor.chain().focus().insertContent(`{{${key}}}`).run();
          }}
        >
          <SelectTrigger className="h-8 w-[190px] text-xs">
            <SelectValue placeholder="Insert placeholder…" />
          </SelectTrigger>
          <SelectContent>
            <div className="px-2 py-1 text-[10px] font-medium uppercase text-muted-foreground">
              Company
            </div>
            {CONTRACT_PLACEHOLDERS.filter((p) => p.key.startsWith("company_")).map((p) => (
              <SelectItem key={p.key} value={p.key}>
                <span className="font-mono text-xs">{`{{${p.key}}}`}</span>
                <span className="ml-2 text-muted-foreground">{p.label}</span>
              </SelectItem>
            ))}
            <div className="px-2 py-1 text-[10px] font-medium uppercase text-muted-foreground">
              Deal
            </div>
            {CONTRACT_PLACEHOLDERS.filter((p) => !p.key.startsWith("company_")).map((p) => (
              <SelectItem key={p.key} value={p.key}>
                <span className="font-mono text-xs">{`{{${p.key}}}`}</span>
                <span className="ml-2 text-muted-foreground">{p.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function RichTextEditor({ value, onChange, placeholder, minHeight = 320 }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image.configure({ inline: false, allowBase64: true }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: placeholder ?? "Start typing…" }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none px-3 py-3 min-h-[--min-h]",
        style: `--min-h:${minHeight}px`,
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  // Keep editor in sync when parent swaps templates
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="rounded-md border bg-background">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
