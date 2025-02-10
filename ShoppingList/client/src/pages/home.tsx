import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertItemSchema, type Item } from "@shared/schema";
import { categorizeItem, type Category, categories } from "@/lib/categories";
import { apiRequest, queryClient } from "@/lib/queryClient";
import confetti from 'canvas-confetti';
import { DndContext, DragEndEvent, TouchSensor, useSensor, useSensors, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { GripVertical, Trash2 } from 'lucide-react';

type FormData = {
  name: string;
};

export default function Home() {
  const { toast } = useToast();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const form = useForm<FormData>({
    defaultValues: {
      name: "",
    },
    resolver: zodResolver(insertItemSchema.pick({ name: true })),
  });

  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  useEffect(() => {
    const preventScroll = (e: TouchEvent) => {
      if (activeId) {
        e.preventDefault();
      }
    };
    document.addEventListener('touchmove', preventScroll, { passive: false });
    return () => document.removeEventListener('touchmove', preventScroll);
  }, [activeId]);

  useEffect(() => {
    let socket: WebSocket;

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      console.log("Attempting WebSocket connection to:", wsUrl);

      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log("WebSocket connection established");
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "UPDATE") {
            queryClient.setQueryData(["/api/items"], data.items);
            const items = data.items as Item[];
            if (items.length > 0 && items.every(item => item.completed)) {
              confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
              });
            }
          }
        } catch (error) {
          console.error("Error processing WebSocket message:", error);
        }
      };

      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        toast({
          title: "Anslutningsfel",
          description: "Det gick inte att ansluta till servern. Ladda om sidan för att försöka igen.",
          variant: "destructive",
        });
      };

      socket.onclose = (event) => {
        console.log("WebSocket connection closed:", event.code, event.reason);
        if (!event.wasClean) {
          toast({
            title: "Anslutningen bröts",
            description: "Anslutningen till servern bröts. Ladda om sidan för att återansluta.",
            variant: "destructive",
          });
        }
      };
    } catch (error) {
      console.error("Error setting up WebSocket:", error);
    }

    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [toast]);

  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const category = categorizeItem(name);
      return apiRequest("POST", "/api/items", {
        name,
        category,
        completed: false,
      });
    },
    onSuccess: () => {
      form.reset();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: number; completed: boolean }) => {
      return apiRequest("PATCH", `/api/items/${id}`, { completed });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, category }: { id: number; category: string }) => {
      return apiRequest("PATCH", `/api/items/${id}`, { category });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/items/${id}`);
    },
  });

  const updateNameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      return apiRequest("PATCH", `/api/items/${id}`, { name });
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/items");
    },
    onSuccess: () => {
      toast({
        title: "Listan rensad",
        description: "Alla varor har tagits bort från listan",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    if (!data.name.trim()) return;
    createMutation.mutate(data.name);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;

    if (!over) return;

    const itemId = parseInt(active.id as string);
    const newCategory = over.id as string;

    const item = items.find(item => item.id === itemId);
    if (item && item.category !== newCategory) {
      updateCategoryMutation.mutate({ id: itemId, category: newCategory });
    }
  };

  const startEditing = (item: Item) => {
    setEditingItem(item.id);
    setEditValue(item.name);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, item: Item) => {
    if (e.key === 'Enter') {
      const newName = editValue.trim();
      if (newName && newName !== item.name) {
        updateNameMutation.mutate({ id: item.id, name: newName });
      }
      setEditingItem(null);
    } else if (e.key === 'Escape') {
      setEditingItem(null);
    }
  };

  // Skapa en ordnad map av kategorier med tomma arrays
  const orderedCategories = Object.keys(categories) as Category[];
  const groupedItems = orderedCategories.reduce((acc, category) => {
    acc[category] = items.filter(item => item.category === category);
    return acc;
  }, {} as Record<Category, Item[]>);

  const activeItem = activeId ? items.find(item => item.id.toString() === activeId) : null;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Inköpslista</CardTitle>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  size="sm"
                  disabled={items.length === 0}
                >
                  Rensa lista
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Är du säker?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Detta kommer att ta bort alla varor från inköpslistan. 
                    Denna åtgärd kan inte ångras.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Avbryt</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteAllMutation.mutate()}
                  >
                    Ta bort allt
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex gap-2">
                <Input
                  placeholder="Lägg till en vara..."
                  {...form.register("name")}
                  className="flex-1"
                />
                <Button type="submit" disabled={createMutation.isPending}>
                  Lägg till
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <DndContext 
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {orderedCategories
            .filter(category => groupedItems[category].length > 0)
            .map((category) => (
            <Card key={category} id={category} className="relative">
              <CardHeader>
                <CardTitle className="capitalize">{category}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {groupedItems[category].map((item) => (
                  <div 
                    key={item.id} 
                    id={item.id.toString()}
                    className={`flex items-center gap-2 p-2 rounded-lg hover:bg-accent touch-manipulation select-none ${
                      activeId === item.id.toString() ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="grip-handle p-2 -m-2 touch-manipulation">
                      <GripVertical className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <Checkbox
                      checked={item.completed}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({
                          id: item.id,
                          completed: checked as boolean,
                        })
                      }
                    />
                    {editingItem === item.id ? (
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => handleEditKeyDown(e, item)}
                        onBlur={() => setEditingItem(null)}
                        className="flex-1"
                        autoFocus
                      />
                    ) : (
                      <span
                        onClick={() => startEditing(item)}
                        className={`flex-1 cursor-pointer ${
                          item.completed ? "line-through text-muted-foreground" : ""
                        }`}
                      >
                        {item.name}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => deleteItemMutation.mutate(item.id)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

          <DragOverlay>
            {activeItem && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-background border shadow-lg select-none">
                <GripVertical className="h-6 w-6 text-muted-foreground" />
                <span>{activeItem.name}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}