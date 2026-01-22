import { useState, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface CollapsibleFilterSectionProps {
  title: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  testId?: string;
}

export function CollapsibleFilterSection({
  title,
  icon,
  defaultOpen = false,
  children,
  testId,
}: CollapsibleFilterSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger 
        className="flex items-center justify-between w-full py-2 hover-elevate rounded-md px-2 -mx-2"
        data-testid={testId ? `collapsible-${testId}` : undefined}
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <h4 className="text-sm font-medium">{title}</h4>
        </div>
        <ChevronDown 
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )} 
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
