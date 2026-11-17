// Core Graphics window IDs are the numeric portion of Electron window source IDs.
// Both APIs use logical desktop coordinates measured from the primary screen's top left.
#include <ApplicationServices/ApplicationServices.h>
#include <stdio.h>
#include <stdlib.h>

int main(int argc, char **argv) {
    if (argc != 2) return 1;
    char *end;
    unsigned long id = strtoul(argv[1], &end, 10);
    if (*end || !id || id > UINT32_MAX) return 1;
    CFArrayRef windows = CGWindowListCopyWindowInfo(kCGWindowListOptionIncludingWindow, (CGWindowID)id);
    int result = 1;
    if (windows && CFArrayGetCount(windows)) {
        CFDictionaryRef info = CFArrayGetValueAtIndex(windows, 0);
        CFDictionaryRef bounds = CFDictionaryGetValue(info, kCGWindowBounds);
        CGRect rect;
        if (bounds && CGRectMakeWithDictionaryRepresentation(bounds, &rect) && !CGRectIsEmpty(rect)) {
            printf("{\"x\":%.0f,\"y\":%.0f,\"width\":%.0f,\"height\":%.0f}\n",
                   rect.origin.x, rect.origin.y, rect.size.width, rect.size.height);
            result = 0;
        }
    }
    if (windows) CFRelease(windows);
    return result;
}
